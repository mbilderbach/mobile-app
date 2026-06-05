import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Platform, TextInput, KeyboardAvoidingView, type LayoutChangeEvent } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Play, Pause, Moon, Sun } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lightColors, darkColors, fonts, spacing, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useThemeControls } from '@/contexts/ThemeContext';
import { Kicker, Chip, PrimaryButton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_COLORS } from '@/lib/types';
import { updatePrayerAfterSession } from '@/lib/prayerProgress';
import { hapticSuccess } from '@/lib/haptics';

/**
 * Pray-along — a full-screen teleprompter for reading a prayer hands-free.
 *
 * The text carries itself upward at a calm, line-by-line pace: the focus line
 * is bright, past lines fade more than upcoming ones, and a soft coral glow
 * (the prayer's category hue) sits behind the focus zone. One tap anywhere
 * pauses and lets the reader sit on a line for as long as they like — the words
 * wait, you never chase them. Tap any line to drift back and re-read.
 *
 * Opens only when a prayer has body text. It begins paused on line one ("Tap to
 * begin") — gentler than auto-running. Violet is reserved for the action: the
 * play control and the closing "Amen · I prayed" button, which completes the
 * reading and marks the prayer prayed in one motion.
 *
 * The ambient glow defaults to coral; it can later derive from the prayer's
 * group/category colour.
 */

const CORAL = '255,126,107'; // default soft coral when a prayer has no category

function hexToRgb(hex: string): string | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Resolve a category colour (preset key or hex) to an "r,g,b" string for the glow. */
function glowFromCategoryColor(color: string): string | null {
  const hex = (GROUP_COLORS as Record<string, string>)[color] || color;
  return hexToRgb(hex);
}

// Dwell time scales with the natural weight of each line, not a metronome.
const DWELL_BASE = 1300;
const DWELL_PER_CHAR = 52;
const DWELL_MIN = 1500;
const DWELL_MAX = 7000;
const GLIDE_MS = 680; // the calm carry between lines
const GLOW_H = 240;
const FOCUS_RATIO = 0.42; // focus line sits a touch above centre, teleprompter-style

type TempoKey = 'slow' | 'calm' | 'flow';
const TEMPOS: { key: TempoKey; label: string; factor: number }[] = [
  { key: 'slow', label: 'Slow', factor: 0.68 },
  { key: 'calm', label: 'Calm', factor: 1.0 },
  { key: 'flow', label: 'Flow', factor: 1.5 },
];

/** Break body text into prayer "lines": one per newline, long lines split on sentences. */
function splitLines(text: string): string[] {
  const raw = text.replace(/\r/g, '').split('\n').map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of raw) {
    if (line.length <= 64) { out.push(line); continue; }
    const parts = (line.match(/[^.!?]+[.!?]*/g) || [line]).map((s) => s.trim()).filter(Boolean);
    let buf = '';
    for (const p of parts) {
      if (((buf ? buf + ' ' : '') + p).length <= 64) buf = (buf ? buf + ' ' : '') + p;
      else { if (buf) out.push(buf); buf = p; }
    }
    if (buf) out.push(buf);
  }
  return out.length ? out : [text.trim()];
}

export default function PrayAlongScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ prayerId?: string; prayerTitle?: string; sharedTitle?: string; sharedBody?: string }>();

  const [lines, setLines] = useState<string[]>([]);
  const [ready, setReady] = useState(false); // measured + viewport sized
  const [measured, setMeasured] = useState(false);
  const [viewportH, setViewportH] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [tempoKey, setTempoKey] = useState<TempoKey>('calm');
  const [hintVisible, setHintVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [glowRgb, setGlowRgb] = useState(CORAL);
  const [showExit, setShowExit] = useState(false);
  const [showReflect, setShowReflect] = useState(false);
  const [reflection, setReflection] = useState('');

  // "Pray in the dark": a per-session light/dark surface, independent of the
  // app theme. Defaults to the app's current scheme; the moon/sun flips it.
  const { scheme } = useThemeControls();
  const [prayDark, setPrayDark] = useState(scheme === 'dark');
  const colors = prayDark ? darkColors : lightColors;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Refs mirror state so timers/animation callbacks never read stale closures.
  const progress = useRef(new Animated.Value(0)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;
  // Fills 0→1 across a line's dwell so the reader can feel the next advance coming.
  const pace = useRef(new Animated.Value(0)).current;
  const linesRef = useRef<string[]>([]);
  const layoutsRef = useRef<{ y: number; height: number }[]>([]);
  const playingRef = useRef(false);
  const currentIndexRef = useRef(0);
  const reachedEndRef = useRef(false);
  const begunRef = useRef(false);
  const tempoFactorRef = useRef(1);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const startRef = useRef(Date.now());
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glideRef = useRef<Animated.CompositeAnimation | null>(null);

  // Load the prayer body.
  useEffect(() => {
    let active = true;
    // Carrying a circle request: the text is passed in directly, no DB read.
    if (params.sharedBody !== undefined) {
      const ls = splitLines(params.sharedBody || '');
      linesRef.current = ls;
      layoutsRef.current = [];
      setLines(ls);
      return () => { active = false; };
    }
    if (!user || !params.prayerId) { setReady(true); return; }
    supabase
      .from('prayers')
      .select('description')
      .eq('id', params.prayerId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!active) return;
        const ls = splitLines(data?.description || '');
        linesRef.current = ls;
        layoutsRef.current = [];
        setLines(ls);
      });

    // Ambient glow takes on the prayer's category colour (falls back to coral).
    supabase
      .from('prayer_groups')
      .select('group_id')
      .eq('prayer_id', params.prayerId)
      .then(({ data }: any) => {
        const gid = data?.[0]?.group_id;
        if (!active || !gid) return;
        supabase
          .from('groups')
          .select('color')
          .eq('id', gid)
          .maybeSingle()
          .then(({ data: g }: any) => {
            if (!active || !g?.color) return;
            const rgb = glowFromCategoryColor(g.color);
            if (rgb) setGlowRgb(rgb);
          });
      });

    return () => { active = false; };
  }, [user, params.prayerId, params.sharedBody]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      glideRef.current?.stop();
    };
  }, []);

  // Settle in once lines are measured and the viewport is sized.
  useEffect(() => {
    if (measured && viewportH > 0 && !ready) {
      setReady(true);
      Animated.timing(enterAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [measured, viewportH, ready, enterAnim]);

  const clearTimers = useCallback(() => {
    if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
    glideRef.current?.stop();
    glideRef.current = null;
    pace.stopAnimation(); pace.setValue(0);
  }, [pace]);

  const dwellFor = useCallback((i: number) => {
    const len = (linesRef.current[i] || '').length;
    const base = Math.min(DWELL_MAX, Math.max(DWELL_MIN, DWELL_BASE + DWELL_PER_CHAR * len));
    return base / tempoFactorRef.current;
  }, []);

  const reachEnd = useCallback(() => {
    playingRef.current = false; setPlaying(false);
    reachedEndRef.current = true; setReachedEnd(true);
    clearTimers();
    const last = Math.max(0, linesRef.current.length - 1);
    Animated.timing(progress, { toValue: last, duration: GLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    currentIndexRef.current = last; setCurrentIndex(last);
  }, [clearTimers, progress]);

  // Hold on line i (dwell), then glide to i+1, repeat — the gentle guided scroll.
  const step = useCallback((i: number) => {
    if (!mountedRef.current || !playingRef.current) return;
    const dwell = dwellFor(i);
    // Pace cue: fill across the dwell so the reader senses the advance approaching.
    // JS-driven (animates width) — fine for one tiny bar; the teleprompter's own
    // carry stays on the native driver.
    pace.setValue(0);
    Animated.timing(pace, { toValue: 1, duration: dwell, easing: Easing.linear, useNativeDriver: false }).start();
    dwellTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || !playingRef.current) return;
      const next = i + 1;
      if (next > linesRef.current.length - 1) { reachEnd(); return; }
      const anim = Animated.timing(progress, { toValue: next, duration: GLIDE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
      glideRef.current = anim;
      anim.start(({ finished }) => {
        glideRef.current = null;
        if (!finished || !mountedRef.current || !playingRef.current) return;
        currentIndexRef.current = next; setCurrentIndex(next);
        step(next);
      });
    }, dwell);
  }, [dwellFor, pace, progress, reachEnd]);

  const play = useCallback(() => {
    if (reachedEndRef.current || linesRef.current.length === 0) return;
    begunRef.current = true; setHintVisible(false);
    playingRef.current = true; setPlaying(true);
    step(currentIndexRef.current);
  }, [step]);

  const pause = useCallback(() => {
    playingRef.current = false; setPlaying(false);
    clearTimers();
    progress.stopAnimation((v: number) => {
      const near = Math.max(0, Math.min(linesRef.current.length - 1, Math.round(v)));
      progress.setValue(near);
      currentIndexRef.current = near; setCurrentIndex(near);
    });
  }, [clearTimers, progress]);

  const toggle = useCallback(() => {
    if (reachedEndRef.current) return;
    if (playingRef.current) pause(); else play();
  }, [pause, play]);

  // Closing mid-prayer shouldn't silently lose the time spent. If they've begun,
  // pause and ask whether to finish with an Amen (logs the session) or discard.
  const requestClose = useCallback(() => {
    if (!begunRef.current || savingRef.current) { router.back(); return; }
    if (playingRef.current) pause();
    setShowExit(true);
  }, [pause, router]);

  // Tap a line to drift to it and sit there (paused).
  const goTo = useCallback((i: number) => {
    begunRef.current = true; setHintVisible(false);
    playingRef.current = false; setPlaying(false);
    reachedEndRef.current = false; setReachedEnd(false);
    clearTimers();
    const anim = Animated.timing(progress, { toValue: i, duration: GLIDE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    glideRef.current = anim;
    anim.start(() => { glideRef.current = null; currentIndexRef.current = i; setCurrentIndex(i); });
  }, [clearTimers, progress]);

  const changeTempo = useCallback((t: { key: TempoKey; factor: number }) => {
    setTempoKey(t.key);
    tempoFactorRef.current = t.factor;
    if (playingRef.current) { clearTimers(); step(currentIndexRef.current); }
  }, [clearTimers, step]);

  const onLineLayout = useCallback((i: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    layoutsRef.current[i] = { y, height };
    if (linesRef.current.length > 0 && layoutsRef.current.filter(Boolean).length === linesRef.current.length) {
      setMeasured(true);
    }
  }, []);

  // Amen opens an optional reflection capture rather than saving immediately,
  // so a finished prayer can hold a note — same gentle step as the quiet timer.
  const requestAmen = useCallback(() => {
    setShowExit(false);
    setShowReflect(true);
  }, []);

  const saveAmen = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    const duration = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    if (user && params.prayerId) {
      await supabase.from('sessions').insert({
        user_id: user.id,
        prayer_id: params.prayerId,
        duration_seconds: duration,
        reflection: reflection.trim() || null,
      });
      await updatePrayerAfterSession(params.prayerId);
    }
    hapticSuccess();
    router.back();
  }, [user, params.prayerId, router, reflection]);

  const focusCenter = viewportH * FOCUS_RATIO;

  // One Animated.Value drives both the upward carry and every line's dim/scale.
  const translateY = useMemo<any>(() => {
    if (!measured || !viewportH || lines.length === 0) return 0;
    const ls = layoutsRef.current;
    if (lines.length === 1) { const c = ls[0]; return focusCenter - (c.y + c.height / 2); }
    return progress.interpolate({
      inputRange: lines.map((_, i) => i),
      outputRange: lines.map((_, i) => focusCenter - (ls[i].y + ls[i].height / 2)),
    });
  }, [measured, viewportH, lines, focusCenter, progress]);

  const lineOpacity = useCallback((i: number): any => {
    if (!measured) return i === 0 ? 1 : 0.18;
    return progress.interpolate({
      inputRange: [i - 2, i - 1, i, i + 1, i + 2],
      outputRange: [0.24, 0.46, 1, 0.18, 0.1], // past (right) fades more than future (left)
      extrapolate: 'clamp',
    });
  }, [measured, progress]);

  const lineScale = useCallback((i: number): any => {
    if (!measured) return 1;
    return progress.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0.97, 1, 0.97], extrapolate: 'clamp' });
  }, [measured, progress]);

  // Read-along cue: on the focus line, each word brightens in turn — sweeping
  // left→right as the dwell elapses. Unread words sit dim grey; the word being
  // read lifts to the bright ink and stays lit once passed (karaoke-style). The
  // words ARE the pace indicator — no separate marker. Only the focus line
  // animates; colours come from the theme so it reads right in light and dark.
  const readRgb = hexToRgb(colors.ink) || '244,243,248';   // read / active → light
  const unreadRgb = hexToRgb(colors.quiet) || '138,137,149'; // upcoming → grey
  const wordColor = useCallback((wi: number, count: number): any => {
    // Each word owns a slice [wi/count, (wi+1)/count] of the dwell; it brightens
    // across its slice, then holds (clamp) for the rest of the line.
    return pace.interpolate({
      inputRange: [wi / count, (wi + 1) / count],
      outputRange: [`rgb(${unreadRgb})`, `rgb(${readRgb})`],
      extrapolate: 'clamp',
    });
  }, [pace, unreadRgb, readRgb]);

  // Resting colour for a non-animating line: lines already passed read light;
  // upcoming lines sit grey. This means a line glides INTO focus already grey,
  // so the word-sweep brightens from grey — no white flash on a new line.
  const restColor = useCallback((i: number) => (i <= currentIndex ? colors.ink : colors.quiet), [currentIndex, colors.ink, colors.quiet]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.close} onPress={requestClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
        <X size={22} color={colors.quiet} />
      </Pressable>

      {/* Pray in the dark — flips this screen's surface only */}
      <Pressable
        style={styles.themeToggle}
        onPress={() => setPrayDark((v) => !v)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={prayDark ? 'Switch to light' : 'Pray in the dark'}
      >
        {prayDark ? <Sun size={20} color={colors.quiet} /> : <Moon size={20} color={colors.quiet} />}
      </Pressable>

      <View style={styles.topMeta} pointerEvents="none">
        <Kicker>Praying</Kicker>
        {(params.prayerTitle || params.sharedTitle) ? <Text style={styles.topTitle} numberOfLines={1}>{params.prayerTitle || params.sharedTitle}</Text> : null}
      </View>

      {/* Focus viewport — tap empty space to pause/resume */}
      <Pressable style={styles.viewport} onPress={toggle} onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}>
        <LinearGradient
          colors={[`rgba(${glowRgb},0)`, `rgba(${glowRgb},0.16)`, `rgba(${glowRgb},0)`]}
          locations={[0, 0.5, 1]}
          style={[styles.glow, { top: focusCenter - GLOW_H / 2 }]}
          pointerEvents="none"
        />

        <Animated.View style={{ opacity: enterAnim }} pointerEvents="box-none">
          <Animated.View style={[styles.column, { transform: [{ translateY }] }]} pointerEvents="box-none">
            {lines.map((ln, i) => {
              const isFocus = i === currentIndex && playing && !reachedEnd;
              const words = isFocus ? ln.split(' ') : null;
              return (
                <Animated.View key={i} onLayout={onLineLayout(i)} style={{ opacity: lineOpacity(i), transform: [{ scale: lineScale(i) }] }}>
                  <Pressable onPress={() => goTo(i)} style={styles.linePress}>
                    {words ? (
                      // Focus line: each word lights in turn as the dwell elapses.
                      <Text style={styles.lineText}>
                        {words.map((w, wi) => (
                          <Animated.Text key={wi} style={{ color: wordColor(wi, words.length) }}>
                            {w}{wi < words.length - 1 ? ' ' : ''}
                          </Animated.Text>
                        ))}
                      </Text>
                    ) : (
                      <Text style={[styles.lineText, { color: restColor(i) }]}>{ln}</Text>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.View>

        {hintVisible && ready && !reachedEnd ? (
          <Animated.View style={[styles.hintWrap, { opacity: enterAnim }]} pointerEvents="none">
            <Text style={styles.hint}>Tap to begin</Text>
          </Animated.View>
        ) : null}
      </Pressable>

      {/* Controls — tempo + play while reading; lands on Amen at the end */}
      <View style={styles.controls}>
        {reachedEnd ? (
          <PrimaryButton label="Amen · I prayed" onPress={requestAmen} loading={saving} style={styles.amen} />
        ) : (
          <>
            <View style={styles.tempoRow}>
              {TEMPOS.map((t) => (
                <Chip key={t.key} label={t.label} selected={tempoKey === t.key} onPress={() => changeTempo(t)} />
              ))}
            </View>
            <Pressable style={styles.playBtn} onPress={toggle} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Begin reading'}>
              {playing ? <Pause size={24} color={colors.onPrimary} fill={colors.onPrimary} /> : <Play size={24} color={colors.onPrimary} fill={colors.onPrimary} />}
            </Pressable>
          </>
        )}
      </View>

      {showExit && (
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>Finish your prayer?</Text>
            <Text style={styles.exitBody}>Close with an Amen to keep this time, or step away without saving.</Text>
            <PrimaryButton label="Amen · I prayed" onPress={requestAmen} loading={saving} style={styles.exitAmen} />
            <Pressable style={styles.exitLink} hitSlop={8} onPress={() => setShowExit(false)} accessibilityRole="button" accessibilityLabel="Keep praying">
              <Text style={styles.exitKeepText}>Keep praying</Text>
            </Pressable>
            <Pressable style={styles.exitLink} hitSlop={8} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Discard">
              <Text style={styles.exitDiscardText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Amen → optional reflection capture before the session is saved. */}
      {showReflect && (
        <KeyboardAvoidingView style={styles.exitOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.reflectCard}>
            <Text style={styles.reflectTitle}>Amen</Text>
            <Text style={styles.reflectBody}>Anything you want to remember from this time?</Text>
            <TextInput
              style={styles.reflectInput}
              placeholder="A reflection… (optional)"
              placeholderTextColor={colors.quiet}
              value={reflection}
              onChangeText={setReflection}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <PrimaryButton label="Done" onPress={saveAmen} loading={saving} style={styles.exitAmen} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  close: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 56,
    right: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  themeToggle: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 56,
    left: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  topMeta: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 28 : 64,
    gap: 4,
  },
  topTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.muted, letterSpacing: -0.2, maxWidth: 280, textAlign: 'center' },
  viewport: { flex: 1, overflow: 'hidden', justifyContent: 'flex-start' },
  glow: { position: 'absolute', left: -40, right: -40, height: GLOW_H },
  column: { paddingHorizontal: spacing.lg },
  linePress: { paddingVertical: 15 },
  lineText: {
    fontFamily: fonts.sansMedium,
    fontSize: 27,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: 'center',
  },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  hint: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.quiet, letterSpacing: 0.2 },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 28 : 44,
    alignItems: 'center',
    gap: 22,
  },
  tempoRow: { flexDirection: 'row', gap: 10 },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  amen: { alignSelf: 'stretch' },

  // Exit confirmation
  exitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25,24,33,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  exitCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    gap: 12,
    ...shadow.card,
  },
  exitTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, letterSpacing: -0.5, textAlign: 'center' },
  exitBody: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, lineHeight: 20, textAlign: 'center', marginBottom: 4 },
  exitAmen: { alignSelf: 'stretch' },
  exitLink: { alignSelf: 'center', paddingVertical: 7 },
  exitKeepText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink, letterSpacing: -0.1 },
  exitDiscardText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.red, letterSpacing: -0.1 },

  // Amen reflection capture
  reflectCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    gap: 12,
    ...shadow.card,
  },
  reflectTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.6, textAlign: 'center' },
  reflectBody: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, lineHeight: 20, textAlign: 'center' },
  reflectInput: {
    minHeight: 104,
    borderRadius: radius.md,
    backgroundColor: colors.fill,
    padding: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
    marginTop: 4,
  },
});
