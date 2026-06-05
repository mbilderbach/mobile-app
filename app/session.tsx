import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  AppState,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Pause, Play, Moon, Sun } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { lightColors, darkColors, fonts, spacing, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useThemeControls } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Chip, PrimaryButton } from '@/components/ui';
import { updatePrayerAfterSession } from '@/lib/prayerProgress';
import { errorMessage, throwIfError } from '@/lib/writeSafety';
import { hapticSuccess } from '@/lib/haptics';
import { useToast } from '@/components/Toast';

type Phase = 'active' | 'capture';

const ARC_SIZE = 200;
const ARC_STROKE = 3;
const ARC_RADIUS = (ARC_SIZE - ARC_STROKE) / 2;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

export default function SessionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ prayerId?: string; prayerTitle?: string; quick?: string }>();

  // "Pray in the dark": a per-session light/dark surface, independent of the app
  // theme. Defaults to the app's current scheme; the moon/sun flips it.
  const { scheme } = useThemeControls();
  const [prayDark, setPrayDark] = useState(scheme === 'dark');
  const colors = prayDark ? darkColors : lightColors;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>('active');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [targetMinutes, setTargetMinutes] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [showAbandon, setShowAbandon] = useState(false);
  const targetReachedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Wall-clock timekeeping so the count stays accurate across backgrounding
  // (JS interval ticks are throttled/paused when the app isn't foregrounded).
  const elapsedBeforeMsRef = useRef(0); // ms banked from prior running stretches
  const runStartRef = useRef<number | null>(null); // ms timestamp of the current run, or null when paused

  // Capture fields
  const [title, setTitle] = useState(params.prayerTitle || '');
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isScheduled = !!params.prayerId;

  // Total elapsed seconds derived purely from wall-clock timestamps.
  const computeSeconds = useCallback(() => {
    const active = runStartRef.current != null ? Date.now() - runStartRef.current : 0;
    return Math.floor((elapsedBeforeMsRef.current + active) / 1000);
  }, []);

  useEffect(() => {
    if (running) {
      runStartRef.current = Date.now();
      // 250ms cadence keeps the display crisp; the value itself comes from the clock.
      intervalRef.current = setInterval(() => setSeconds(computeSeconds()), 250);
    } else if (runStartRef.current != null) {
      // Pausing: bank the current stretch and stop the clock.
      elapsedBeforeMsRef.current += Date.now() - runStartRef.current;
      runStartRef.current = null;
      setSeconds(computeSeconds());
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [running, computeSeconds]);

  // Snap the display back to true elapsed time the moment we return to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSeconds(computeSeconds());
    });
    return () => sub.remove();
  }, [computeSeconds]);

  // Choosing a target resets the "reached" latch so completion fires once per target.
  const chooseTarget = (m: number | null) => {
    targetReachedRef.current = false;
    setTargetMinutes((prev) => (prev === m ? null : m));
    setCustomOpen(false);
  };

  const applyCustom = () => {
    const n = parseInt(customMin, 10);
    if (Number.isFinite(n) && n > 0 && n <= 600) {
      targetReachedRef.current = false;
      setTargetMinutes(n);
      setCustomOpen(false);
      setCustomMin('');
    }
  };

  // Gentle one-time cue when a chosen target duration is reached (no forced stop).
  const targetSecs = targetMinutes ? targetMinutes * 60 : 0;
  const targetReached = !!targetMinutes && seconds >= targetSecs;
  useEffect(() => {
    if (targetReached && !targetReachedRef.current) {
      targetReachedRef.current = true;
      hapticSuccess();
    }
  }, [targetReached]);

  const handleEnd = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('capture');
  };

  const handleAbandon = () => {
    setShowAbandon(false);
    router.back();
  };

  /**
   * Finish a session.
   *  - 'log'  : record the time only (against the scheduled prayer if any, else a
   *             standalone log). Returns to where you came from.
   *  - 'save' : create a prayer from the title, log the time against it, then drop
   *             into its editor so reminders can be set up like any new prayer.
   */
  const finishSession = async (mode: 'log' | 'save') => {
    if (!user || saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      let prayerId = params.prayerId || null;

      if (mode === 'save' && !prayerId && title.trim()) {
        const newPrayerResult = await supabase
          .from('prayers')
          .insert({ user_id: user.id, title: title.trim(), is_library: true, status: 'active' })
          .select()
          .single();
        throwIfError(newPrayerResult, 'Could not create this prayer. Your reflection is still here.');
        if (newPrayerResult.data) prayerId = newPrayerResult.data.id;
      }

      throwIfError(await supabase.from('sessions').insert({
        user_id: user.id,
        prayer_id: prayerId,
        duration_seconds: seconds,
        reflection: reflection.trim() || null,
      }), 'Could not save this session. Your reflection is still here.');

      if (prayerId) {
        await updatePrayerAfterSession(prayerId);
      }

      hapticSuccess();

      // Saved as a prayer → open its editor so reminders can be added now.
      if (mode === 'save' && prayerId && !params.prayerId) {
        showToast('🙏 Saved as a prayer');
        router.replace({ pathname: '/edit-prayer', params: { id: prayerId } });
      } else {
        showToast('🙏 Session logged');
        router.back();
      }
    } catch (error) {
      setSaveError(errorMessage(error, 'Could not save this session. Your reflection is still here.'));
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const arcProgress = targetMinutes
    ? Math.min(seconds / (targetMinutes * 60), 1)
    : 0;
  const arcOffset = ARC_CIRCUMFERENCE * (1 - arcProgress);

  // --- Active phase ---
  if (phase === 'active') {
    return (
      <View style={styles.activeContainer}>
        {/* X button — abandon */}
        <Pressable style={styles.closeButton} onPress={() => setShowAbandon(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="End session">
          <X size={22} color={colors.quiet} />
        </Pressable>

        {/* Prayer context */}
        {params.prayerTitle && (
          <Text style={styles.prayerContext}>Praying for {params.prayerTitle}</Text>
        )}

        {/* Timer with optional arc */}
        <View style={styles.timerWrap}>
          {targetMinutes && (
            <Svg width={ARC_SIZE} height={ARC_SIZE} style={styles.arcSvg}>
              <Circle
                cx={ARC_SIZE / 2}
                cy={ARC_SIZE / 2}
                r={ARC_RADIUS}
                stroke={colors.divider}
                strokeWidth={ARC_STROKE}
                fill="none"
              />
              <Circle
                cx={ARC_SIZE / 2}
                cy={ARC_SIZE / 2}
                r={ARC_RADIUS}
                stroke={targetReached ? colors.success : colors.quiet}
                strokeWidth={ARC_STROKE}
                fill="none"
                strokeDasharray={`${ARC_CIRCUMFERENCE}`}
                strokeDashoffset={arcOffset}
                strokeLinecap="round"
                transform={`rotate(-90, ${ARC_SIZE / 2}, ${ARC_SIZE / 2})`}
              />
            </Svg>
          )}
          <Text style={styles.timer}>{formatTime(seconds)}</Text>
        </View>

        {/* Target status: remaining time, or a gentle "complete" once reached. */}
        {targetMinutes ? (
          <Text
            style={[styles.targetStatus, targetReached && styles.targetStatusDone]}
            numberOfLines={1}
          >
            {targetReached ? '🙏 Time complete' : `${formatTime(Math.max(0, targetSecs - seconds))} left`}
          </Text>
        ) : null}

        {/* Duration presets + custom — one tidy row that never wraps. */}
        {customOpen ? (
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Minutes"
              placeholderTextColor={colors.quiet}
              value={customMin}
              onChangeText={(t) => setCustomMin(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              autoFocus
              maxLength={3}
              returnKeyType="done"
              onSubmitEditing={applyCustom}
            />
            <Pressable style={styles.customSet} onPress={applyCustom} accessibilityRole="button" accessibilityLabel="Set duration">
              <Text style={styles.customSetText}>Set</Text>
            </Pressable>
            <Pressable style={styles.customCancel} onPress={() => { setCustomOpen(false); setCustomMin(''); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
              <X size={18} color={colors.quiet} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.presets}>
            {[1, 5, 10].map((m) => (
              <Chip
                key={m}
                label={`${m}m`}
                selected={targetMinutes === m}
                onPress={() => chooseTarget(m)}
                style={styles.presetChip}
              />
            ))}
            <Chip
              label={targetMinutes && ![1, 5, 10].includes(targetMinutes) ? `${targetMinutes}m` : 'Custom'}
              selected={!!targetMinutes && ![1, 5, 10].includes(targetMinutes)}
              onPress={() => setCustomOpen(true)}
              style={styles.presetChip}
            />
          </View>
        )}

        {/* Controls: Pause + End */}
        <View style={styles.controls}>
          <Pressable
            style={styles.pauseButton}
            onPress={() => setRunning(!running)}
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pause timer' : 'Resume timer'}
          >
            {running ? <Pause size={22} color={colors.ink} /> : <Play size={22} color={colors.ink} />}
          </Pressable>
          <Pressable style={styles.endButton} onPress={handleEnd} accessibilityRole="button" accessibilityLabel="End and save">
            <Text style={styles.endButtonText} maxFontSizeMultiplier={1.4}>End</Text>
          </Pressable>
        </View>

        {/* Leave confirmation — offer to keep the time (save) before discarding. */}
        <Modal visible={showAbandon} transparent animationType="fade" onRequestClose={() => setShowAbandon(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Leave this session?</Text>
              <Text style={styles.modalBody}>
                You’ve been praying for {formatTime(seconds)}. Save it, or step away without keeping it.
              </Text>
              <Pressable style={styles.modalSave} onPress={() => { setShowAbandon(false); handleEnd(); }}>
                <Text style={styles.modalSaveText}>Save & end</Text>
              </Pressable>
              <Pressable style={styles.modalLink} hitSlop={8} onPress={() => setShowAbandon(false)}>
                <Text style={styles.modalKeepText}>Keep praying</Text>
              </Pressable>
              <Pressable style={styles.modalLink} hitSlop={8} onPress={handleAbandon}>
                <Text style={styles.modalPrimaryText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // --- Post-session: Variant A (scheduled prayer) ---
  if (isScheduled) {
    return (
      <KeyboardAvoidingView
        style={styles.captureContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.captureHeader}>
          <Text style={styles.captureTime}>{formatTime(seconds)}</Text>
          <Text style={styles.captureContext}>{params.prayerTitle}</Text>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.captureContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.reflectionPrompt}>Anything you want to remember?</Text>
          <TextInput
            style={styles.reflectionInput}
            placeholder="A reflection… (optional)"
            placeholderTextColor={colors.quiet}
            value={reflection}
            onChangeText={setReflection}
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </ScrollView>

        <View style={styles.captureFooter}>
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          <PrimaryButton label="Done" onPress={() => finishSession('log')} disabled={saving} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // --- Post-session: Variant B (freeform) ---
  return (
    <KeyboardAvoidingView
      style={styles.captureContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.captureHeader}>
        <Text style={styles.captureTime}>{formatTime(seconds)}</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.captureContent} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.freeformTitle}
          placeholder="Name this prayer (optional)"
          placeholderTextColor={colors.faint}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          autoFocus
        />

        <TextInput
          style={styles.reflectionInput}
          placeholder="A reflection… (optional)"
          placeholderTextColor={colors.quiet}
          value={reflection}
          onChangeText={setReflection}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.saveHint}>
          {title.trim()
            ? 'Save it to return to and set reminders, or just log the time.'
            : 'Add a name to keep this as a prayer you can return to. Otherwise just log the time.'}
        </Text>
      </ScrollView>

      {/* Two clear paths: keep it as a prayer (then set reminders), or just log. */}
      <View style={styles.captureFooter}>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        {title.trim() ? (
          <>
            <PrimaryButton label="Save as a prayer" onPress={() => finishSession('save')} disabled={saving} loading={saving} />
            <Pressable
              style={styles.logOnlyLink}
              hitSlop={8}
              onPress={() => finishSession('log')}
              accessibilityRole="button"
              accessibilityLabel="Just log it, don't save"
            >
              <Text style={styles.logOnlyText}>Just log it</Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton label="Log session" onPress={() => finishSession('log')} disabled={saving} loading={saving} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },

  // === Active phase ===
  activeContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 24 : 60,
    right: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggle: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 24 : 60,
    left: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  prayerContext: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.quiet,
    position: 'absolute',
    top: Platform.OS === 'web' ? 48 : 84,
    alignSelf: 'center',
  },
  timerWrap: {
    width: ARC_SIZE,
    height: ARC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcSvg: {
    position: 'absolute',
  },
  timer: {
    fontFamily: fonts.display,
    fontSize: 68,
    color: colors.ink,
    letterSpacing: -2,
  },
  targetStatus: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.muted,
    marginTop: 14,
    letterSpacing: -0.1,
  },
  targetStatusDone: {
    color: colors.success,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  presetChip: {
    paddingHorizontal: 14,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  customInput: {
    width: 110,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    paddingHorizontal: 18,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },
  customSet: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSetText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.onPrimary,
  },
  customCancel: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 48,
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  endButtonText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.onPrimary,
  },

  // Abandon modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(25,24,33,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    gap: 12,
    ...shadow.card,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSave: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  modalSaveText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.onPrimary,
    letterSpacing: -0.2,
  },
  modalLink: {
    alignSelf: 'center',
    paddingVertical: 7,
  },
  modalKeepText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
    letterSpacing: -0.1,
  },
  modalPrimaryText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.red,
  },

  // === Capture phase (shared) ===
  captureContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  captureHeader: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 48 : 88,
    paddingBottom: spacing.lg,
  },
  captureTime: {
    fontFamily: fonts.display,
    fontSize: 46,
    color: colors.ink,
    letterSpacing: -1.5,
  },
  captureContext: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.quiet,
    marginTop: 6,
  },
  captureContent: {
    padding: spacing.lg,
    paddingTop: 8,
    gap: 16,
  },
  reflectionPrompt: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.muted,
    letterSpacing: -0.2,
  },
  freeformTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 20,
    color: colors.ink,
    letterSpacing: -0.2,
    padding: 0,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  reflectionInput: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 26,
    minHeight: 120,
    padding: 0,
  },
  saveHint: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.quiet,
    lineHeight: 19,
    paddingTop: 4,
  },
  logOnlyLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  logOnlyText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.muted,
    letterSpacing: -0.1,
  },

  // Footer
  captureFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    backgroundColor: colors.paper,
  },
  saveError: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
    marginBottom: 10,
  },
});
