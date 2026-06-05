/**
 * NovaAssistHeader — the panel header for the Nova Assist surface.
 *
 * Figma spec: a 60px-tall bar with the wordmark on the left and a trailing menu
 * (hamburger) button, on the Nova canvas with a hairline bottom divider.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Menu } from 'lucide-react-native';
import { nova, NOVA_FONT } from './tokens';

export function NovaAssistHeader({
  title = 'Nova Assist',
  onMenuPress,
  style,
}: {
  title?: string;
  onMenuPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.bar, style]}>
      <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.4} accessibilityRole="header">
        {title}
      </Text>

      <Pressable
        onPress={onMenuPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Menu"
        style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
      >
        <Menu size={24} color={nova.slate} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    paddingHorizontal: 18,
    backgroundColor: nova.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: nova.line,
  },
  title: {
    fontFamily: NOVA_FONT.heavy,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: nova.slate,
  },
  menuBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
});
