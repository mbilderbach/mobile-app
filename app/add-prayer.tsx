import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, BookOpen } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/lib/types';
import { Kicker, Chip, PrimaryButton } from '@/components/ui';
import { CategoryPicker } from '@/components/CategoryPicker';
import { buildNextFire } from '@/lib/schedule';
import { schedulePrayerNotification } from '@/lib/notifications';
import { errorMessage, throwIfError } from '@/lib/writeSafety';

const ROW_HEIGHT = 52;
const REPEAT_ROW_HEIGHT = 72;
const NOTES_MIN_H = 150;

function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDisplayTime(t: string): string {
  if (!t) return '';
  return new Date(`2000-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function dateFromISO(iso: string): Date {
  if (!iso) return new Date();
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function timeFromValue(time: string): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const [hours, minutes] = (time || '08:00').split(':').map(Number);
  d.setHours(hours || 0, minutes || 0);
  return d;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function AddPrayerScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const notesRef = useRef<TextInput>(null);
  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);

  // Pre-fill from Explore ("Use this prayer"): the form opens populated and the
  // user edits/owns it. A pending category (by name) is reconciled to an existing
  // group or created fresh on save — see handleSave.
  const prefill = useLocalSearchParams<{
    prefillTitle?: string;
    prefillBody?: string;
    prefillCategoryName?: string;
    prefillCategoryColor?: string;
    prefillCategoryEmoji?: string;
  }>();

  const [title, setTitle] = useState(prefill.prefillTitle || '');
  const [notes, setNotes] = useState(prefill.prefillBody || '');
  const [notesHeight, setNotesHeight] = useState(NOTES_MIN_H);
  // Body from Explore reads beautifully in the teleprompter — default it on.
  const [readAlong, setReadAlong] = useState(!!prefill.prefillBody);
  const [categories, setCategories] = useState<Group[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // A category named by Explore that may not exist as a group yet.
  const [pendingCategoryName] = useState<string | null>(prefill.prefillCategoryName || null);
  const [reminderOn, setReminderOn] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
  const [recurrence, setRecurrence] = useState('none');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reminderAnim = useRef(new RNAnimated.Value(0)).current;
  const buttonAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
      .then(({ data }) => {
        const groups = data || [];
        setCategories(groups);
        // If Explore named a category that already exists as a group, select it.
        if (pendingCategoryName) {
          const match = groups.find((g) => g.name.toLowerCase() === pendingCategoryName.toLowerCase());
          if (match) setSelectedCategoryId(match.id);
        }
      });
  }, [user, pendingCategoryName]);

  useEffect(() => {
    RNAnimated.timing(reminderAnim, {
      toValue: reminderOn ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();

    if (reminderOn && !scheduleDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduleDate(tomorrow.toISOString().split('T')[0]);
    }
    if (reminderOn && !scheduleTime) {
      setScheduleTime('08:00');
    }
  }, [reminderOn]);

  useEffect(() => {
    RNAnimated.timing(buttonAnim, {
      toValue: title.trim().length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [title]);

  const onNotesSize = useCallback((e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setNotesHeight(Math.max(NOTES_MIN_H, e.nativeEvent.contentSize.height + 28));
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);
    setSaveError(null);

    try {
      const hasBody = notes.trim().length > 0;
      const payload: any = {
        user_id: user.id,
        title: title.trim(),
        description: notes.trim() || null,
        read_along: hasBody && readAlong,
        status: 'active',
        is_library: true,
      };

      if (reminderOn && scheduleDate) {
        payload.schedule_date = scheduleDate;
        payload.schedule_time = scheduleTime || null;
        payload.recurrence = recurrence;
        payload.next_fire = buildNextFire(scheduleDate, scheduleTime);
        payload.notification_id = await schedulePrayerNotification({
          title: title.trim(),
          scheduleDate,
          scheduleTime,
        });
      }

      const result = await supabase.from('prayers').insert(payload).select('id').maybeSingle();
      throwIfError(result, 'Could not save this prayer. Your text is still here.');

      if (result.data) {
        // Resolve the category to attach: an explicitly chosen one, or — for a
        // prayer brought in from Explore — create the named category on the fly.
        let groupId = selectedCategoryId;
        if (!groupId && pendingCategoryName) {
          const created = await supabase
            .from('groups')
            .insert({
              user_id: user.id,
              name: pendingCategoryName,
              color: prefill.prefillCategoryColor || 'stone',
              emoji: prefill.prefillCategoryEmoji || null,
            })
            .select('id')
            .maybeSingle();
          if (created.data) groupId = created.data.id;
        }
        if (groupId) {
          throwIfError(
            await supabase.from('prayer_groups').insert({ prayer_id: result.data.id, group_id: groupId }),
            'The prayer saved, but the category could not be attached.'
          );
        }
      }

      router.back();
    } catch (error) {
      setSaveError(errorMessage(error, 'Could not save this prayer. Your text is still here.'));
    } finally {
      setSaving(false);
    }
  };

  const openDatePicker = () => {
    if (Platform.OS === 'web' && dateInputRef.current) {
      dateInputRef.current.showPicker?.();
      dateInputRef.current.click?.();
    } else if (Platform.OS === 'android') {
      setShowAndroidDatePicker(true);
    }
  };

  const openTimePicker = () => {
    if (Platform.OS === 'web' && timeInputRef.current) {
      timeInputRef.current.showPicker?.();
      timeInputRef.current.click?.();
    } else if (Platform.OS === 'android') {
      setShowAndroidTimePicker(true);
    }
  };

  const handleNativeDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowAndroidDatePicker(false);
    if (selected) setScheduleDate(toISODate(selected));
  };

  const handleNativeTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowAndroidTimePicker(false);
    if (selected) setScheduleTime(toTimeValue(selected));
  };

  const reminderHeight = reminderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ROW_HEIGHT + ROW_HEIGHT + ROW_HEIGHT + REPEAT_ROW_HEIGHT],
  });

  const borderOpacity = buttonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const hasTitle = title.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>New prayer</Text>
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title — multiline so long titles/placeholder wrap instead of clipping. */}
          <TextInput
            style={styles.titleInput}
            placeholder="Who or what are you praying for?"
            placeholderTextColor={colors.quiet}
            value={title}
            onChangeText={setTitle}
            autoFocus
            multiline
            scrollEnabled={false}
            maxLength={200}
          />

          {/* Category */}
          {user && (
            <CategoryPicker
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              onCreated={(g) => { setCategories((prev) => [...prev, g]); setSelectedCategoryId(g.id); }}
              onUpdated={(g) => setCategories((prev) => prev.map((c) => (c.id === g.id ? g : c)))}
              userId={user.id}
            />
          )}

          {/* Notes / scripture / context — grows with content */}
          <View style={styles.fieldSection}>
            <Kicker>Notes & scripture</Kicker>
            <TextInput
              ref={notesRef}
              style={[styles.notesInput, { height: notesHeight }]}
              placeholder="Write or paste a prayer, scripture, notes, or context…"
              placeholderTextColor={colors.quiet}
              value={notes}
              onChangeText={setNotes}
              onContentSizeChange={onNotesSize}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {notes.trim().length > 0 && (
              <View style={styles.readAlongRow}>
                <View style={styles.readAlongLeft}>
                  <BookOpen size={18} color={colors.muted} />
                  <View style={styles.readAlongText}>
                    <Text style={styles.readAlongLabel}>Read along in Pray-along</Text>
                    <Text style={styles.readAlongSub}>Gently scroll this text while you pray</Text>
                  </View>
                </View>
                <Switch
                  value={readAlong}
                  onValueChange={setReadAlong}
                  trackColor={{ false: colors.divider, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            )}
          </View>

          {/* Reminder card */}
          <View style={styles.reminderCard}>
            <View style={styles.reminderHeader}>
              <Kicker>Reminder</Kicker>
              <Switch
                value={reminderOn}
                onValueChange={setReminderOn}
                trackColor={{ false: colors.divider, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            <RNAnimated.View style={[styles.reminderExpand, { height: reminderHeight, opacity: reminderAnim }]}>
              <View style={styles.reminderDivider} />

              {/* Date picker row */}
              <Pressable style={styles.reminderRow} onPress={openDatePicker}>
                <View style={styles.reminderRowLeft}>
                  <Calendar size={16} color={colors.muted} />
                  <Text style={styles.reminderRowLabel}>Date</Text>
                </View>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={dateFromISO(scheduleDate)}
                    mode="date"
                    display="compact"
                    onChange={handleNativeDateChange}
                    accentColor={colors.primary}
                  />
                ) : (
                  <Text style={styles.reminderRowValue}>
                    {formatDisplayDate(scheduleDate) || 'Tomorrow'}
                  </Text>
                )}
                {Platform.OS === 'web' && (
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={scheduleDate}
                    onChange={(e: any) => setScheduleDate(e.target.value)}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      top: 0,
                      left: 0,
                      cursor: 'pointer',
                    }}
                  />
                )}
              </Pressable>
              {Platform.OS === 'android' && showAndroidDatePicker && (
                <DateTimePicker
                  value={dateFromISO(scheduleDate)}
                  mode="date"
                  display="default"
                  onChange={handleNativeDateChange}
                />
              )}

              <View style={styles.reminderDivider} />

              {/* Time picker row */}
              <Pressable style={styles.reminderRow} onPress={openTimePicker}>
                <View style={styles.reminderRowLeft}>
                  <Clock size={16} color={colors.muted} />
                  <Text style={styles.reminderRowLabel}>Time</Text>
                </View>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={timeFromValue(scheduleTime)}
                    mode="time"
                    display="compact"
                    onChange={handleNativeTimeChange}
                    accentColor={colors.primary}
                  />
                ) : (
                  <Text style={styles.reminderRowValue}>
                    {formatDisplayTime(scheduleTime) || '8:00 AM'}
                  </Text>
                )}
                {Platform.OS === 'web' && (
                  <input
                    ref={timeInputRef}
                    type="time"
                    value={scheduleTime}
                    onChange={(e: any) => setScheduleTime(e.target.value)}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      top: 0,
                      left: 0,
                      cursor: 'pointer',
                    }}
                  />
                )}
              </Pressable>
              {Platform.OS === 'android' && showAndroidTimePicker && (
                <DateTimePicker
                  value={timeFromValue(scheduleTime)}
                  mode="time"
                  display="default"
                  onChange={handleNativeTimeChange}
                />
              )}

              <View style={styles.reminderDivider} />
              <View style={styles.repeatSection}>
                <Kicker style={styles.repeatSectionLabel}>Repeat</Kicker>
                <View style={styles.repeatRow}>
                  {(['none', 'daily', 'weekly', 'monthly'] as const).map((opt) => (
                    <Chip
                      key={opt}
                      label={opt === 'none' ? 'Once' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      selected={recurrence === opt}
                      onPress={() => setRecurrence(opt)}
                    />
                  ))}
                </View>
              </View>
            </RNAnimated.View>
          </View>
        </ScrollView>

        {/* Sticky save button */}
        <View style={styles.saveArea}>
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          <RNAnimated.View style={{ opacity: borderOpacity }}>
            <PrimaryButton
              label={saving ? 'Saving…' : 'Save prayer'}
              onPress={handleSave}
              disabled={!hasTitle || saving}
            />
          </RNAnimated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingBottom: 16,
  },
  cancelText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
  navTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, letterSpacing: -0.3 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 22 },

  titleInput: {
    fontFamily: fonts.sansMedium,
    fontSize: 25,
    lineHeight: 31,
    color: colors.ink,
    letterSpacing: -0.3,
    minHeight: 40,
    padding: 0,
  },

  fieldSection: { gap: 10 },

  notesInput: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 25,
    padding: 16,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
  },
  readAlongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readAlongLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  readAlongText: { flex: 1, gap: 2 },
  readAlongLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, letterSpacing: -0.2 },
  readAlongSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },

  reminderCard: { backgroundColor: colors.sectionBg, borderRadius: radius.lg, overflow: 'hidden' },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: ROW_HEIGHT, paddingHorizontal: 16 },
  reminderExpand: { overflow: 'hidden' },
  reminderDivider: { height: 1, backgroundColor: colors.hairline, marginLeft: 16 },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: ROW_HEIGHT, paddingHorizontal: 16, position: 'relative' as any },
  reminderRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderRowLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  reminderRowValue: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink, letterSpacing: -0.15 },
  repeatSection: { height: REPEAT_ROW_HEIGHT, paddingHorizontal: 16, justifyContent: 'center' },
  repeatSectionLabel: { marginBottom: 10 },
  repeatRow: { flexDirection: 'row', gap: 6 },

  saveArea: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 24 : 40, backgroundColor: colors.paper },
  saveError: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.error, lineHeight: 18, marginBottom: 10 },
});
