import { Tabs } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Plus, Pencil, Timer, X } from 'lucide-react-native';
import { fonts, spacing, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';

function CustomTabBar() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isToday = pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
  const isBrowse = pathname === '/library' || pathname === '/(tabs)/library';
  const isTogether = pathname === '/together' || pathname === '/(tabs)/together';

  const go = (action: () => void) => { setMenuOpen(false); action(); };

  return (
    <View style={styles.barOuter}>
      <View style={styles.bar}>
        <Pressable
          style={[styles.tabItem, isToday && styles.tabItemActive]}
          onPress={() => router.push('/(tabs)')}
          accessibilityRole="tab"
          accessibilityLabel="Today"
          accessibilityState={{ selected: isToday }}
        >
          <Text style={[styles.tabLabel, isToday && styles.tabLabelActive]} maxFontSizeMultiplier={1.4}>Today</Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, isBrowse && styles.tabItemActive]}
          onPress={() => router.push('/(tabs)/library')}
          accessibilityRole="tab"
          accessibilityLabel="Prayers"
          accessibilityState={{ selected: isBrowse }}
        >
          <Text style={[styles.tabLabel, isBrowse && styles.tabLabelActive]} maxFontSizeMultiplier={1.4}>Prayers</Text>
        </Pressable>
        <Pressable
          style={[styles.tabItem, isTogether && styles.tabItemActive]}
          onPress={() => router.push('/(tabs)/together')}
          accessibilityRole="tab"
          accessibilityLabel="Together"
          accessibilityState={{ selected: isTogether }}
        >
          <Text style={[styles.tabLabel, isTogether && styles.tabLabelActive]} maxFontSizeMultiplier={1.4}>Together</Text>
        </Pressable>
      </View>
      <Pressable style={styles.fab} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Create">
        <Plus size={20} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => go(() => router.push('/add-prayer'))}>
              <View style={styles.menuIcon}><Pencil size={19} color={colors.selectedText} /></View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>New prayer</Text>
                <Text style={styles.menuSub}>Save a prayer to return to</Text>
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => go(() => router.push({ pathname: '/session', params: { quick: '1' } }))}>
              <View style={styles.menuIcon}><Timer size={19} color={colors.selectedText} /></View>
              <View style={styles.menuBody}>
                <Text style={styles.menuTitle}>Just pray now</Text>
                <Text style={styles.menuSub}>A quiet one-off session</Text>
              </View>
            </Pressable>
            <Pressable style={styles.menuClose} onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="together" />
    </Tabs>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  barOuter: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingTop: 8,
    backgroundColor: colors.paper,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  tabItemActive: {
    backgroundColor: colors.fill,
  },
  tabLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.muted,
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    fontFamily: fonts.sansBold,
    color: colors.ink,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 28,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(25,24,33,0.32)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
  },
  menuSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 10,
    gap: 4,
    ...shadow.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
  },
  menuItemPressed: { backgroundColor: colors.fill },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.selectedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBody: { flex: 1, gap: 2 },
  menuTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink, letterSpacing: -0.2 },
  menuSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  menuClose: { alignSelf: 'center', padding: 10, marginTop: 2 },
});
