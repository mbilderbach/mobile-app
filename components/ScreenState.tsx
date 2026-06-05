/**
 * Shared loading / error / offline views for data-backed screens.
 *
 * These let a screen distinguish "still loading" and "failed to load" from the
 * legitimately-empty account state (which each screen renders itself). The
 * error view offers a Retry and softens to an offline message when the failure
 * looks like a dropped connection.
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CloudOff, RotateCw } from 'lucide-react-native';
import { fonts, spacing, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { SecondaryButton } from '@/components/ui';

/** Lifecycle of a screen's primary data fetch. */
export type LoadStatus = 'loading' | 'error' | 'ready';

export function LoadingState({ label }: { label?: string }) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
      <ActivityIndicator color={colors.quiet} />
      {label ? <Text style={styles.dim}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ offline, onRetry }: { offline?: boolean; onRetry?: () => void }) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        {offline ? <CloudOff size={26} color={colors.quiet} /> : <RotateCw size={24} color={colors.quiet} />}
      </View>
      <Text style={styles.title}>{offline ? "You're offline" : "Couldn't load"}</Text>
      <Text style={styles.body}>
        {offline
          ? 'Check your connection and try again.'
          : 'Something went wrong while loading. Please try again.'}
      </Text>
      {onRetry ? <SecondaryButton label="Try again" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: 10,
  },
  iconWrap: { marginBottom: 4 },
  dim: { fontFamily: fonts.sans, fontSize: 13, color: colors.quiet },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.ink, letterSpacing: -0.3 },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  retry: { marginTop: 12, paddingHorizontal: 28, alignSelf: 'center' },
});
