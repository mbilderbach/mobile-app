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
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Calendar, Clock, BookOpen } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Kicker, Chip, PrimaryButton } from '@/components/ui';
import { CategoryPicker } from '@/components/CategoryPicker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/lib/types';
import { buildNextFire } from '@/lib/schedule';
import { cancelPrayerNotification, reschedulePrayerNotification } from '@/lib/notifications';
import { errorMessage, throwIfError } from '@/lib/writeSafety';

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

export default function EditPrayerScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const dateInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notesHeight, setNotesHeight] = useState(NOTES_MIN_H);
  const [readAlong, setReadAlong] = useState(false);
  const [categories, setCategories] = useState<Group[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
  const [recurrence, setRecurrence] = useState('none');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('groups')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
      .then(({ data }) => setCategories(data || []));
  }, [user]);

  useEffect(() => {
    if (!user || !id) return;

    supabase
      .from('prayers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setTitle(data.title);
        setDescription(data.description || '');
        setReadAlong(!!data.read_along);
        if (data.schedule_date) {
          setShowReminder(true);
          setScheduleDate(data.schedule_date);
          setScheduleTime(data.schedule_time || '');
          setRecurrence(data.recurrence || 'none');
        }
        setNotificationId(data.notification_id || null);
      });

    supabase
      .from('prayer_groups')
      .select('group_id')
      .eq('prayer_id', id)
      .then(({ data }) => {
        if (data && data.length > 0) setSelectedCategoryId(data[0].group_id);
      });
  }, [user, id]);

  const onNotesSize = useCallback((e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setNotesHeight(Math.max(NOTES_MIN_H, e.nativeEvent.contentSize.height + 28));
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !user || !id) return;
    setSaving(true);
    setSaveError(null);

    try {
      const hasBody = description.trim().length > 0;
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        read_along: hasBody && readAlong,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      if (showReminder && scheduleDate) {
        payload.schedule_date = scheduleDate;
        payload.schedule_time = scheduleTime || null;
        payload.recurrence = recurrence;
        payload.next_fire = buildNextFire(scheduleDate, scheduleTime);
        payload.notification_id = await reschedulePrayerNotification({
          previousId: notificationId,
          title: title.trim(),
          scheduleDate,
          scheduleTime,
        });
      } else {
        await cancelPrayerNotification(notificationId);
        payload.schedule_date = null;
        payload.schedule_time = null;
        payload.recurrence = 'none';
        payload.next_fire = null;
        payload.notification_id = null;
      }

      throwIfError(await supabase.from('prayers').update(payload).eq('id', id), 'Could not save these changes. Your text is still here.');

      throwIfError(await supabase.from('prayer_groups').delete().eq('prayer_id', id), 'Saved the prayer, but could not update its category.');
      if (selectedCategoryId) {
        throwIfError(await supabase.from('prayer_groups').insert({ prayer_id: id, group_id: selectedCategoryId }), 'Saved the prayer, but could not update its category.');
      }

      router.back();
    } catch (error) {
      setSaveError(errorMessage(error, 'Could not save these changes. Your text is still here.'));
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <X size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit prayer</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.titleInput}
          placeholder="Title"
          placeholderTextColor={colors.quiet}
          value={title}
          onChangeText={setTitle}
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
        <View style={styles.field}>
          <Kicker>Notes & scripture</Kicker>
          <TextInput
            style={[styles.descInput, { height: notesHeight }]}
            placeholder="Write or paste a prayer, scripture, notes, or context…"
            placeholderTextColor={colors.quiet}
            value={description}
            onChangeText={setDescription}
            onContentSizeChange={onNotesSize}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />

          {description.trim().length > 0 && (
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

        {/* Reminder */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <Kicker>Reminder</Kicker>
            <Switch
              value={showReminder}
              onValueChange={setShowReminder}
              trackColor={{ false: colors.divider, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {showReminder && (
            <View style={styles.reminderFields}>
              <View style={styles.reminderDivider} />

              {/* Date picker */}
              <Pressable style={styles.reminderRow} onPress={openDatePicker}>
                <View style={styles.reminderRowLeft}>
                  <Calendar size={16} color={colors.quiet} />
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
                    {formatDisplayDate(scheduleDate) || 'Select date'}
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

              {/* Time picker */}
              <Pressable style={styles.reminderRow} onPress={openTimePicker}>
                <View style={styles.reminderRowLeft}>
                  <Clock size={16} color={colors.quiet} />
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
                    {formatDisplayTime(scheduleTime) || 'Select time'}
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

              {/* Repeat */}
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
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        <PrimaryButton
          label={saving ? 'Saving…' : 'Save'}
          onPress={handleSave}
          disabled={!title.trim() || saving}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: 24, paddingBottom: 40 },
  titleInput: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: -0.6,
    paddingVertical: 4,
  },
  field: { gap: 10 },
  descInput: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 25,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
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
  reminderCard: {
    backgroundColor: colors.sectionBg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
  },
  reminderFields: {},
  reminderDivider: { height: 1, backgroundColor: colors.hairline, marginLeft: 16 },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    position: 'relative' as any,
  },
  reminderRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderRowLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
  reminderRowValue: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink, letterSpacing: -0.15 },
  repeatSection: { paddingHorizontal: 16, paddingVertical: 14 },
  repeatSectionLabel: { marginBottom: 10 },
  repeatRow: { flexDirection: 'row', gap: 8 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  saveError: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.error, lineHeight: 18, marginBottom: 10 },
});
