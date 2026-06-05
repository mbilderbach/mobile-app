/**
 * Haptic craft primitives.
 *
 * Small, composable building blocks that encode the refined Haptic language so
 * screens stay consistent. Reach for these before hand-rolling views.
 *
 * Themed: each block's styles come from a `make*(colors)` factory, resolved per
 * render via `useTheme()` so the primitives follow light/dark automatically.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fonts, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';

/* ── ScreenTitle ────────────────────────────────────────────────────────── */
export function ScreenTitle({
  title,
  subtitle,
  size = 'hero',
  style,
}: {
  title: string;
  subtitle?: string;
  size?: 'hero' | 'page';
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const s = useMemo(() => makeTitle(colors), [colors]);
  const t = size === 'hero' ? s.hero : s.page;
  const sub = size === 'hero' ? s.heroSub : s.pageSub;
  return (
    <View style={style}>
      <Text style={t} numberOfLines={2} maxFontSizeMultiplier={1.4} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={sub} maxFontSizeMultiplier={1.4}>{subtitle}</Text> : null}
    </View>
  );
}

const makeTitle = (colors: ThemeColors) => StyleSheet.create({
  hero: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.2, color: colors.ink },
  heroSub: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44, letterSpacing: -1, color: colors.faint, marginTop: 2 },
  page: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8, color: colors.ink },
  pageSub: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: colors.faint, marginTop: 1 },
});

/* ── Kicker ─────────────────────────────────────────────────────────────── */
export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const colors = useTheme();
  const s = useMemo(() => makeKicker(colors), [colors]);
  return <Text style={[s.base, style]}>{children}</Text>;
}

const makeKicker = (colors: ThemeColors) => StyleSheet.create({
  base: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.quiet,
  },
});

/* ── Card ───────────────────────────────────────────────────────────────── */
export function Card({
  children,
  onPress,
  style,
  padded = true,
  feature = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  feature?: boolean;
}) {
  const colors = useTheme();
  const cardStyle = useMemo(() => makeCard(colors), [colors]);
  const base = [
    cardStyle.base,
    feature && cardStyle.feature,
    padded && cardStyle.padded,
    style,
  ];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && cardStyle.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

const makeCard = (colors: ThemeColors) => StyleSheet.create({
  base: { backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card },
  feature: { borderRadius: radius.xl },
  padded: { padding: 20 },
  pressed: { opacity: 0.96, transform: [{ scale: 0.994 }] },
});

/* ── GhostPill ──────────────────────────────────────────────────────────── */
export function GhostPill({
  label,
  icon,
  style,
  textStyle,
}: {
  label: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const colors = useTheme();
  const ghostStyle = useMemo(() => makeGhost(colors), [colors]);
  return (
    <View style={[ghostStyle.pill, style]}>
      {icon}
      <Text style={[ghostStyle.text, textStyle]}>{label}</Text>
    </View>
  );
}

const makeGhost = (colors: ThemeColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: 'transparent',
  },
  text: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, letterSpacing: -0.1 },
});

/* ── Chip ───────────────────────────────────────────────────────────────── */
export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const chipStyle = useMemo(() => makeChip(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      style={[chipStyle.base, selected ? chipStyle.selected : chipStyle.unselected, style]}
    >
      <Text style={[chipStyle.text, selected ? chipStyle.textSelected : chipStyle.textUnselected]} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

const makeChip = (colors: ThemeColors) => StyleSheet.create({
  base: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill },
  unselected: { backgroundColor: colors.fill },
  selected: { backgroundColor: colors.selectedBg },
  text: { fontFamily: fonts.sansMedium, fontSize: 13.5, letterSpacing: -0.1 },
  textUnselected: { color: colors.muted },
  textSelected: { color: colors.selectedText, fontFamily: fonts.sansSemiBold },
});

/* ── IconChip ───────────────────────────────────────────────────────────── */
export function IconChip({ children, size = 34, style }: { children: React.ReactNode; size?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useTheme();
  const s = useMemo(() => makeIconChip(colors), [colors]);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, s.base, style]}>
      {children}
    </View>
  );
}

const makeIconChip = (colors: ThemeColors) => StyleSheet.create({
  base: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});

/* ── ActionRow ──────────────────────────────────────────────────────────── */
export function ActionRow({
  icon,
  label,
  sublabel,
  value,
  trailing,
  onPress,
  style,
}: {
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const actionRowStyle = useMemo(() => makeActionRow(colors), [colors]);
  const inner = (
    <>
      {icon ? <IconChip>{icon}</IconChip> : null}
      <View style={actionRowStyle.body}>
        <Text style={actionRowStyle.label} numberOfLines={1}>{label}</Text>
        {sublabel ? <Text style={actionRowStyle.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={actionRowStyle.value} numberOfLines={1}>{value}</Text> : null}
      {trailing ?? (onPress ? <ChevronRight size={18} color={colors.quiet} /> : null)}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[label, sublabel, value].filter(Boolean).join(', ')}
        style={({ pressed }) => [actionRowStyle.row, pressed && actionRowStyle.pressed, style]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[actionRowStyle.row, style]}>{inner}</View>;
}

const makeActionRow = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.sectionBg,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.92 },
  body: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15.5, color: colors.ink, letterSpacing: -0.2 },
  sublabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  value: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted, letterSpacing: -0.1 },
});

/* ── PrimaryButton / SecondaryButton ──────────────────────────────────────── */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const btnStyle = useMemo(() => makeBtn(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [btnStyle.primary, pressed && btnStyle.primaryPressed, disabled && btnStyle.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <>
          {icon}
          <Text style={btnStyle.primaryText} maxFontSizeMultiplier={1.6}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const btnStyle = useMemo(() => makeBtn(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [btnStyle.secondary, pressed && btnStyle.secondaryPressed, disabled && btnStyle.disabled, style]}
    >
      <Text style={btnStyle.secondaryText} maxFontSizeMultiplier={1.6}>{label}</Text>
    </Pressable>
  );
}

const makeBtn = (colors: ThemeColors) => StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.float,
  },
  primaryPressed: { backgroundColor: colors.primaryDark },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.onPrimary, letterSpacing: -0.2 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  secondaryPressed: { backgroundColor: colors.fill },
  secondaryText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink, letterSpacing: -0.2 },
  disabled: { opacity: 0.45 },
});
