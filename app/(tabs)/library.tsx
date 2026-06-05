import React, { useCallback, useRef, useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, ChevronRight, Tag } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Prayer, Group } from '@/lib/types';
import { EXPLORE_CATEGORIES, searchExplore, explorePrayerSubtitle } from '@/lib/explore';
import { ScreenTitle, Kicker, Chip, GhostPill } from '@/components/ui';
import { LoadingState, ErrorState, type LoadStatus } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { SwipeTabs } from '@/components/SwipeTabs';
import { isOfflineError } from '@/lib/writeSafety';

type BrowseView = 'active' | 'attention' | 'answered' | 'archived';

const DEFAULT_NEGLECT_DAYS = 7;

function buildSecondary(prayer: Prayer): string {
  const parts: string[] = [];
  if (prayer.schedule_time) {
    parts.push(new Date(`2000-01-01T${prayer.schedule_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
  }
  if (prayer.recurrence && prayer.recurrence !== 'none') {
    parts.push(prayer.recurrence.charAt(0).toUpperCase() + prayer.recurrence.slice(1));
  }
  return parts.join(' · ');
}

function browseSecondary(prayer: Prayer): string {
  const meta = buildSecondary(prayer);
  if (meta) return meta;
  if (prayer.description) return prayer.description.slice(0, 60);
  return '';
}

function formatAnsweredDate(date: string | null): string {
  if (!date) return 'Answered';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

function attentionDays(prayer: Prayer): number {
  return prayer.neglect_threshold_days || DEFAULT_NEGLECT_DAYS;
}

function needsAttention(prayer: Prayer): boolean {
  if (prayer.status === 'answered' || prayer.status === 'archived') return false;
  const basis = prayer.last_prayed_at || prayer.created_at;
  const days = daysSince(basis);
  return days !== null && days >= attentionDays(prayer);
}

function attentionMeta(prayer: Prayer): string {
  const days = daysSince(prayer.last_prayed_at || prayer.created_at) || 0;
  if (!prayer.last_prayed_at) return days <= 0 ? 'Never prayed' : `Never prayed · ${days}d old`;
  return days === 0 ? 'Prayed today' : `Last prayed ${days}d ago`;
}

interface Section {
  key: string;
  name: string;
  items: Prayer[];
}

export default function BrowseScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showError } = useToast();
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [categories, setCategories] = useState<Group[]>([]);
  const [prayerCategory, setPrayerCategory] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState<BrowseView>('active');
  const [searchFocused, setSearchFocused] = useState(false);
  // Sub-tabs within the Prayers screen: the user's own list vs. the library.
  const [tab, setTab] = useState<'mine' | 'explore'>('mine');
  const [exploreSearch, setExploreSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [offline, setOffline] = useState(false);
  const loadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!loadedRef.current) setStatus('loading');

    try {
      const prRes = await supabase
        .from('prayers')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (prRes.error) throw prRes.error;
      const catsRes = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (catsRes.error) throw catsRes.error;
      const pgRes = await supabase
        .from('prayer_groups')
        .select('prayer_id, group_id');
      if (pgRes.error) throw pgRes.error;

      setPrayers(prRes.data || []);
      setCategories(catsRes.data || []);
      const map: Record<string, string> = {};
      (pgRes.data || []).forEach((r: any) => { if (!map[r.prayer_id]) map[r.prayer_id] = r.group_id; });
      setPrayerCategory(map);

      loadedRef.current = true;
      setStatus('ready');
    } catch (error) {
      if (loadedRef.current) showError(isOfflineError(error) ? "You're offline" : "Couldn't refresh");
      else { setOffline(isOfflineError(error)); setStatus('error'); }
    }
  }, [user, showError]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const q = search.trim().toLowerCase();
  const prayersForView = prayers.filter((p) => {
    if (view === 'attention') return needsAttention(p);
    if (view === 'answered') return p.status === 'answered';
    if (view === 'archived') return p.status === 'archived';
    return p.status !== 'answered' && p.status !== 'archived';
  });
  const filtered = q
    ? prayersForView.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.answer_note || '').toLowerCase().includes(q)
      )
    : prayersForView;

  const buildSections = (): Section[] => {
    const buckets: Record<string, Prayer[]> = {};
    const uncategorized: Prayer[] = [];
    filtered.forEach((p) => {
      const cid = prayerCategory[p.id];
      if (cid) (buckets[cid] = buckets[cid] || []).push(p);
      else uncategorized.push(p);
    });
    const sections: Section[] = categories
      .filter((c) => buckets[c.id]?.length)
      .map((c) => ({ key: c.id, name: `${c.emoji ? `${c.emoji} ` : ''}${c.name}`, items: buckets[c.id] }));
    if (uncategorized.length) sections.push({ key: 'uncategorized', name: 'Uncategorized', items: uncategorized });
    return sections;
  };

  const renderRow = (prayer: Prayer) => {
    const secondary = browseSecondary(prayer);
    const answered = prayer.status === 'answered';
    const attention = view === 'attention';
    return (
      <Pressable
        key={prayer.id}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push({ pathname: '/prayer/[id]', params: { id: prayer.id } })}
      >
        <View style={styles.rowContent}>
          {answered && (
            <GhostPill label={formatAnsweredDate(prayer.answered_at)} style={styles.answeredPill} />
          )}
          {attention && (
            <GhostPill label={attentionMeta(prayer)} style={styles.answeredPill} />
          )}
          <Text style={styles.rowTitle} numberOfLines={1}>{prayer.title}</Text>
          {answered && prayer.answer_note ? (
            <Text style={styles.rowMeta} numberOfLines={2}>{prayer.answer_note}</Text>
          ) : attention ? (
            <Text style={styles.rowMeta} numberOfLines={1}>A gentle nudge to return to this prayer.</Text>
          ) : secondary.length > 0 && (
            <Text style={styles.rowMeta} numberOfLines={1}>{secondary}</Text>
          )}
        </View>
        <ChevronRight size={16} color={colors.faint} />
      </Pressable>
    );
  };

  const sections = buildSections();
  const exploreQuery = exploreSearch.trim();
  const exploreHits = exploreQuery ? searchExplore(exploreQuery) : [];

  return (
    <SwipeTabs onRight={() => router.push('/(tabs)')}>
    <View style={styles.container}>
      {/* Prayers is purely the content library. Practice stats + settings now
          live on Today; only category management (a content action) stays here. */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        <Pressable onPress={() => router.push('/categories')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Manage categories">
          <Tag size={20} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.header}>
        <ScreenTitle title="Prayers" size="page" />
      </View>

      {/* Sub-tabs — the user's own prayers vs. the bundled library. They sit
          above the search bar; each tab carries its own scoped search. */}
      <View style={styles.subTabs}>
        {([
          ['mine', 'My Prayers'],
          ['explore', 'Explore'],
        ] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.subTabLabel, active && styles.subTabLabelActive]} maxFontSizeMultiplier={1.4}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'mine' ? (
        status === 'loading' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <ErrorState offline={offline} onRetry={fetchData} />
        ) : (
          <>
            <View style={styles.searchWrap}>
              <View style={styles.searchBar}>
                <Search size={16} color={colors.quiet} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search prayers & notes"
                  placeholderTextColor={colors.quiet}
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Filters stay out of the way until you search, keeping the list clean.
                  They also remain visible whenever a non-default filter is active. */}
              {(searchFocused || view !== 'active') && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.filterRow}
                >
                  {([
                    ['active', 'Active'],
                    ['attention', 'Needs attention'],
                    ['answered', 'Answered'],
                    ['archived', 'Archived'],
                  ] as const).map(([key, label]) => (
                    <Chip
                      key={key}
                      label={label}
                      selected={view === key}
                      onPress={() => setView(key)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.quiet} />}
            >
              {filtered.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {search
                      ? 'Nothing matched'
                      : view === 'attention' ? 'Nothing needs attention'
                      : view === 'answered' ? 'No answered prayers yet'
                      : view === 'archived' ? 'No archived prayers yet'
                      : 'Your saved prayers will live here.\nFind one under Explore, or tap + to write your own.'}
                  </Text>
                </View>
              )}

              {sections.map((s) => (
                <View key={s.key} style={styles.listGroup}>
                  <View style={styles.groupHeader}>
                    <Kicker>{s.name}</Kicker>
                    <Text style={styles.groupCount}>{s.items.length}</Text>
                  </View>
                  {s.items.map((prayer) => renderRow(prayer))}
                </View>
              ))}
            </ScrollView>
          </>
        )
      ) : (
        /* Explore tab — its own search, scoped to the bundled library only. */
        <>
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Search size={16} color={colors.quiet} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search the prayer library"
                placeholderTextColor={colors.quiet}
                value={exploreSearch}
                onChangeText={setExploreSearch}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {exploreQuery ? (
              exploreHits.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No prayers matched “{exploreQuery}”.</Text>
                </View>
              ) : (
                <View style={styles.listGroup}>
                  <View style={styles.groupHeader}>
                    <Kicker>Results</Kicker>
                    <Text style={styles.groupCount}>{exploreHits.length}</Text>
                  </View>
                  {exploreHits.map(({ category, prayer }) => (
                    <Pressable
                      key={`${category.id}-${prayer.id}`}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      onPress={() => router.push({ pathname: '/explore-prayer', params: { categoryId: category.id, id: prayer.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={prayer.title}
                    >
                      <View style={styles.rowContent}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{prayer.title}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {category.emoji} {category.name}
                          {explorePrayerSubtitle(prayer) ? ` · ${explorePrayerSubtitle(prayer)}` : ''}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.faint} />
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              /* Default Explore view — browse by category. */
              <View style={styles.exploreGrid}>
                {EXPLORE_CATEGORIES.map((c) => (
                  <Pressable
                    key={c.id}
                    style={({ pressed }) => [styles.exploreCard, pressed && styles.exploreCardPressed]}
                    onPress={() => router.push({ pathname: '/explore-category', params: { id: c.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name} prayers`}
                  >
                    <Text style={styles.exploreEmoji}>{c.emoji}</Text>
                    <Text style={styles.exploreName}>{c.name}</Text>
                    <Text style={styles.exploreTagline} numberOfLines={2}>{c.tagline}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
    </SwipeTabs>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    // paddingTop is applied inline from safe-area insets.
    paddingBottom: 12,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
  },
  subTabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
  },
  subTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  subTabActive: {
    backgroundColor: colors.fill,
  },
  subTabLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.muted,
    letterSpacing: -0.2,
  },
  subTabLabelActive: {
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
    gap: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.fill,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
  },
  exploreCard: {
    // Two per row, accounting for the 12px gap between them.
    width: '48%',
    flexGrow: 1,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: 6,
  },
  exploreCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  exploreEmoji: {
    fontSize: 24,
  },
  exploreName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15.5,
    color: colors.ink,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  exploreTagline: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.muted,
    lineHeight: 17,
  },
  listGroup: {
    paddingTop: 18,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: 8,
  },
  groupCount: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.quiet,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
  },
  rowPressed: {
    backgroundColor: colors.fill,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  answeredPill: {
    marginBottom: 8,
  },
  rowTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.ink,
    letterSpacing: -0.16,
  },
  rowMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    marginTop: 3,
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.quiet,
    textAlign: 'center',
    lineHeight: 21,
  },
});
