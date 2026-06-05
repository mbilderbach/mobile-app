import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Vibrate, Volume2, Bell, BarChart3, UserCircle, Sun, Moon, SunMoon } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme, useThemeControls } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsGroup, SettingsRow } from '@/components/SettingsGroup';
import { ScreenTitle } from '@/components/ui';
import { usePreferences, type ThemeMode } from '@/lib/preferences';
import { hapticSelection } from '@/lib/haptics';

const APPEARANCE: { mode: ThemeMode; label: string }[] = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { mode, setMode } = useThemeControls();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Persisted UI preferences (Haptic-style toggles).
  const { preferences, setPreference } = usePreferences();

  const toggle = (key: 'haptics' | 'sounds' | 'reminders') => (value: boolean) => {
    setPreference(key, value);
    // A confirming tick — fires when turning haptics on, or via the other toggles.
    if (key !== 'haptics' || value) hapticSelection();
  };

  const chooseMode = (m: ThemeMode) => {
    setMode(m);
    hapticSelection();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <ScreenTitle title="Settings" size="page" style={styles.title} />

        <SettingsGroup label="Account">
          <SettingsRow icon={<UserCircle size={20} color={colors.muted} />} label="Email" value={user?.email || ''} />
          <SettingsRow
            icon={<BarChart3 size={20} color={colors.muted} />}
            label="Your practice"
            onPress={() => router.push('/profile')}
          />
        </SettingsGroup>

        {/* Appearance — Auto follows the phone; Light/Dark force a theme. */}
        <View style={styles.appearanceGroup}>
          <Text style={styles.groupLabel}>APPEARANCE</Text>
          <View style={styles.segment}>
            {APPEARANCE.map(({ mode: m, label }) => {
              const active = mode === m;
              const Icon = m === 'auto' ? SunMoon : m === 'light' ? Sun : Moon;
              return (
                <Pressable
                  key={m}
                  onPress={() => chooseMode(m)}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} appearance`}
                  accessibilityState={{ selected: active }}
                >
                  <Icon size={18} color={active ? colors.selectedText : colors.muted} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.footnote}>Auto follows your phone’s light or dark setting.</Text>
        </View>

        <SettingsGroup label="Preferences" footnote="Haptics and sounds play gentle feedback as you complete sessions.">
          <SettingsRow
            icon={<Vibrate size={20} color={colors.muted} />}
            label="Haptic feedback"
            toggle
            on={preferences.haptics}
            onToggle={toggle('haptics')}
          />
          <SettingsRow
            icon={<Volume2 size={20} color={colors.muted} />}
            label="Sound effects"
            toggle
            on={preferences.sounds}
            onToggle={toggle('sounds')}
          />
          <SettingsRow
            icon={<Bell size={20} color={colors.muted} />}
            label="Reminders"
            toggle
            on={preferences.reminders}
            onToggle={toggle('reminders')}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow label="Sign out" destructive onPress={handleSignOut} />
        </SettingsGroup>

        <Text style={styles.version}>{signingOut ? 'Signing out…' : 'Version 1.0.0'}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingBottom: spacing.xl,
  },
  back: { alignSelf: 'flex-start', marginBottom: spacing.md },
  title: { marginBottom: spacing.lg },
  appearanceGroup: { marginBottom: 28 },
  groupLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.quiet,
    marginBottom: 10,
    marginLeft: 6,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  segmentItemActive: { backgroundColor: colors.selectedBg },
  segmentText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted, letterSpacing: -0.1 },
  segmentTextActive: { color: colors.selectedText, fontFamily: fonts.sansSemiBold },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.quiet,
    lineHeight: 18,
    marginTop: 10,
    marginLeft: 6,
  },
  version: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet, textAlign: 'center', marginTop: 8 },
});
