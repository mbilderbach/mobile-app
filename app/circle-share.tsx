import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView, Pressable, ScrollView, Switch,
  type NativeSyntheticEvent, type TextInputContentSizeChangeEventData,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Clock, EyeOff, BookOpen } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Kicker, Chip, PrimaryButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { shareRequest } from '@/lib/circles';
import { errorMessage } from '@/lib/writeSafety';

const NOTES_MIN_H = 120;
const CATEGORY_SUGGESTIONS = ['Health', 'Family', 'Work', 'Guidance', 'Gratitude', 'Hard season'];

/**
 * Share a prayer into the circle. Title is required; body, category, anonymity,
 * and an optional time-bound "moment" are all opt-in. A body enables Pray-along
 * for carriers; a moment lets the circle converge at the same time.
 */
export default function CircleShareScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useToast();
  const { circleId } = useLocalSearchParams<{ circleId: string }>();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bodyHeight, setBodyHeight] = useState(NOTES_MIN_H);
  const [category, setCategory] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [hasMoment, setHasMoment] = useState(false);
  const [moment, setMoment] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [showAndroidDate, setShowAndroidDate] = useState(false);
  const [showAndroidTime, setShowAndroidTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<TextInput>(null);

  const disabled = !title.trim() || busy || !circleId;

  const onBodySize = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) =>
    setBodyHeight(Math.max(NOTES_MIN_H, e.nativeEvent.contentSize.height + 24));

  const submit = async () => {
    if (disabled || !user) return;
    setBusy(true);
    try {
      await shareRequest({
        circleId,
        ownerId: user.id,
        title,
        body: body.trim() || null,
        category: category.trim() || null,
        anonymous,
        momentAt: hasMoment ? moment.toISOString() : null,
      });
      router.back();
    } catch (error) {
      showError(errorMessage(error, 'Could not share this prayer. Your text is still here.'));
      setBusy(false);
    }
  };

  const onDate = (_e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowAndroidDate(false);
    if (d) setMoment((prev) => { const n = new Date(prev); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); return n; });
  };
  const onTime = (_e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowAndroidTime(false);
    if (d) setMoment((prev) => { const n = new Date(prev); n.setHours(d.getHours(), d.getMinutes(), 0, 0); return n; });
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>Share a prayer</Text>
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.titleInput}
            placeholder="What can your circle pray for?"
            placeholderTextColor={colors.faint}
            value={title}
            onChangeText={setTitle}
            autoFocus
            maxLength={140}
            multiline
          />

          <View style={styles.field}>
            <Kicker>A little more (optional)</Kicker>
            <TextInput
              ref={bodyRef}
              style={[styles.bodyInput, { height: bodyHeight }]}
              placeholder="Context, a scripture, the words you’d pray…"
              placeholderTextColor={colors.quiet}
              value={body}
              onChangeText={setBody}
              onContentSizeChange={onBodySize}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />
            {body.trim().length > 0 && (
              <View style={styles.hintRow}>
                <BookOpen size={15} color={colors.quiet} />
                <Text style={styles.hintText}>Carriers can read this in Pray-along while they pray.</Text>
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Kicker>Category (optional)</Kicker>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? '' : c)} />
              ))}
            </ScrollView>
          </View>

          {/* Anonymous within the circle — for requests too tender to sign. */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleLeft}>
              <EyeOff size={18} color={colors.muted} />
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Share anonymously</Text>
                <Text style={styles.toggleSub}>Your circle sees the request, not your name</Text>
              </View>
            </View>
            <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ false: colors.divider, true: colors.primary }} thumbColor={colors.white} />
          </View>

          {/* Time-bound moment — the seed of synchronized prayer. */}
          <View style={styles.momentCard}>
            <View style={styles.toggleLeft}>
              <Clock size={18} color={colors.muted} />
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>A moment to pray</Text>
                <Text style={styles.toggleSub}>Let the circle gather at the same time</Text>
              </View>
              <Switch value={hasMoment} onValueChange={setHasMoment} trackColor={{ false: colors.divider, true: colors.primary }} thumbColor={colors.white} />
            </View>

            {hasMoment && (
              <View style={styles.momentPickers}>
                {Platform.OS === 'ios' ? (
                  <>
                    <DateTimePicker value={moment} mode="date" display="compact" onChange={onDate} accentColor={colors.primary} />
                    <DateTimePicker value={moment} mode="time" display="compact" onChange={onTime} accentColor={colors.primary} />
                  </>
                ) : (
                  <>
                    <Pressable style={styles.androidPick} onPress={() => setShowAndroidDate(true)}>
                      <Text style={styles.androidPickText}>{moment.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    </Pressable>
                    <Pressable style={styles.androidPick} onPress={() => setShowAndroidTime(true)}>
                      <Text style={styles.androidPickText}>{moment.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
                    </Pressable>
                    {showAndroidDate && <DateTimePicker value={moment} mode="date" onChange={onDate} />}
                    {showAndroidTime && <DateTimePicker value={moment} mode="time" onChange={onTime} />}
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label="Share with circle" onPress={submit} disabled={disabled} loading={busy} />
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
    paddingTop: Platform.OS === 'web' ? 18 : 56,
    paddingBottom: 12,
  },
  cancel: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.muted },
  navTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 24, gap: 22 },
  titleInput: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 29,
    paddingTop: 8,
  },
  field: { gap: 10 },
  bodyInput: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    padding: 14,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet, flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15.5, color: colors.ink, letterSpacing: -0.2 },
  toggleSub: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, lineHeight: 17 },
  momentCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14 },
  momentPickers: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  androidPick: { backgroundColor: colors.fill, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  androidPickText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: Platform.OS === 'web' ? 24 : 40, paddingTop: 8 },
});
