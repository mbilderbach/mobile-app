import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { fonts, spacing, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenTitle } from '@/components/ui';
import { findExploreCategory, explorePrayerSubtitle } from '@/lib/explore';

/**
 * Explore category — a browsable list of pre-written prayers in one theme
 * (Morning, Healing, …). Tapping a prayer opens its full preview. Content is
 * bundled (see lib/explore.ts); this screen reads it synchronously.
 */
export default function ExploreCategoryScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = findExploreCategory(id);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!category ? (
          <View style={styles.missing}>
            <Text style={styles.missingText}>This collection isn’t available.</Text>
          </View>
        ) : (
          <>
            <ScreenTitle
              title={`${category.emoji} ${category.name}`}
              subtitle={category.tagline}
              size="page"
              style={styles.title}
            />

            <View style={styles.list}>
              {category.prayers.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => router.push({ pathname: '/explore-prayer', params: { categoryId: category.id, id: p.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={p.title}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.rowBlurb} numberOfLines={2}>{explorePrayerSubtitle(p)}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.faint} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  title: { marginBottom: 12 },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
  },
  rowPressed: { backgroundColor: colors.fill },
  rowContent: { flex: 1, marginRight: 12, gap: 3 },
  rowTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16.5,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  rowBlurb: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.muted,
    lineHeight: 19,
  },
  missing: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  missingText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.quiet,
  },
});
