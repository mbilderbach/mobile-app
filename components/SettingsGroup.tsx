import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Kicker, IconChip } from '@/components/ui';
import { fonts, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Haptic-style grouped settings list.
 *
 * Usage:
 *   <SettingsGroup label="Preferences">
 *     <SettingsRow icon={<Vibrate/>} label="Haptics" toggle value={on} onToggle={setOn} />
 *     <SettingsRow label="Notification offset" value="15m before" onPress={...} />
 *   </SettingsGroup>
 */

interface GroupProps {
  label?: string;
  footnote?: string;
  children: React.ReactNode;
}

export function SettingsGroup({ label, footnote, children }: GroupProps) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {label ? <Kicker style={styles.groupLabel}>{label}</Kicker> : null}
      <View style={styles.card}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {child}
          </View>
        ))}
      </View>
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
}

interface RowProps {
  label: string;
  icon?: React.ReactNode;
  /** Trailing static value text (e.g. "15m before"). */
  value?: string;
  /** Render as a toggle row. */
  toggle?: boolean;
  on?: boolean;
  onToggle?: (v: boolean) => void;
  /** Tap handler — shows a chevron unless a toggle/value is present. */
  onPress?: () => void;
  destructive?: boolean;
}

export function SettingsRow({
  label,
  icon,
  value,
  toggle,
  on,
  onToggle,
  onPress,
  destructive,
}: RowProps) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const content = (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon ? <IconChip size={32} style={styles.iconChip}>{icon}</IconChip> : null}
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {toggle ? (
          <Switch
            value={on}
            onValueChange={onToggle}
            accessibilityLabel={label}
            trackColor={{ false: colors.divider, true: colors.primary }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.divider}
          />
        ) : onPress ? (
          <ChevronRight size={18} color={colors.quiet} />
        ) : null}
      </View>
    </View>
  );

  if (onPress && !toggle) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  group: { marginBottom: 28 },
  groupLabel: {
    marginBottom: 10,
    marginLeft: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 18 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  pressed: { backgroundColor: colors.fill },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconChip: { backgroundColor: colors.fill },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink, letterSpacing: -0.2, flexShrink: 1 },
  rowLabelDestructive: { color: colors.error },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, letterSpacing: -0.1 },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.quiet,
    lineHeight: 18,
    marginTop: 10,
    marginLeft: 6,
    marginRight: 8,
  },
});
