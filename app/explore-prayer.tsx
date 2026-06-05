import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { fonts, spacing, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Kicker, PrimaryButton } from '@/components/ui';
import { findExplorePrayer } from '@/lib/explore';

/**
 * Explore prayer — full preview of one pre-written prayer, with a single action
 * to make it your own. "Use this prayer" hands the text to the New Prayer form
 * (pre-filled), so the user edits and owns it from day one rather than copying a
 * read-only template. The Explore content itself is never mutated.
 */
export default function ExplorePrayerScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { categoryId, id } = useLocalSearchParams<{ categoryId: string; id: string }>();
  const found = findExplorePrayer(categoryId, id);

  const useThisPrayer = () => {
    if (!found) return;
    router.push({
      pathname: '/add-prayer',
      params: {
        prefillTitle: found.prayer.title,
        prefillBody: found.prayer.body,
        prefillCategoryName: found.category.name,
        prefillCategoryColor: found.category.categoryKey,
        prefillCategoryEmoji: found.category.emoji,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      {!found ? (
        <View style={styles.missing}>
          <Text style={styles.missingText}>This prayer isn’t available.</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Kicker style={styles.kicker}>{found.category.emoji} {found.category.name}</Kicker>
            <Text style={styles.title}>{found.prayer.title}</Text>
            {found.prayer.author ? (
              <Text style={styles.attribution}>
                {found.prayer.author}
                {found.prayer.date && !found.prayer.author.includes(found.prayer.date) ? ` · ${found.prayer.date}` : ''}
              </Text>
            ) : null}
            <Text style={styles.body}>{found.prayer.body}</Text>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton label="Use this prayer" onPress={useThisPrayer} />
            <Text style={styles.footnote}>You can edit every word — it becomes yours.</Text>
          </View>
        </>
      )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  kicker: { marginBottom: 12 },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.ink,
    marginBottom: 6,
  },
  attribution: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.quiet,
    letterSpacing: -0.1,
    marginBottom: 22,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 18,
    lineHeight: 30,
    color: colors.inkSoft,
    letterSpacing: -0.2,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    gap: 10,
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.quiet,
    textAlign: 'center',
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.quiet,
  },
});
