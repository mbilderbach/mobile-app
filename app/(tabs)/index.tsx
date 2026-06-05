import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Settings } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Prayer, Session } from '@/lib/types';
import { ScreenTitle, Kicker, Card, GhostPill } from '@/components/ui';
import { LoadingState, ErrorState, type LoadStatus } from '@/components/ScreenState';
import { useToast } from '@/components/Toast';
import { SwipeTabs } from '@/components/SwipeTabs';
import { isOfflineError } from '@/lib/writeSafety';
import { isOverdue, recurrenceLabel } from '@/lib/schedule';

function buildSecondary(prayer: Prayer): string {
  const parts: string[] = [];
  if (isOverdue(prayer)) {
    parts.push('Overdue');
  }
  if (prayer.schedule_time) {
    parts.push(formatTime(prayer.schedule_time));
  }
  const recurrence = recurrenceLabel(prayer.recurrence);
  if (recurrence) parts.push(recurrence);
  return parts.join(' · ');
}

function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Text prayers opted into read-along open the teleprompter; everything else, the quiet timer. */
function prayRoute(prayer: Prayer) {
  if (prayer.description?.trim() && prayer.read_along) {
    return { pathname: '/pray-along' as const, params: { prayerId: prayer.id, prayerTitle: prayer.title } };
  }
  return { pathname: '/session' as const, params: { prayerId: prayer.id, prayerTitle: prayer.title } };
}

export default function TodayScreen() {
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showError } = useToast();
  const [forToday, setForToday] = useState<Prayer[]>([]);
  const [prayedToday, setPrayedToday] = useState<(Session & { prayer?: Prayer })[]>([]);
  const [hasPrayers, setHasPrayers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [offline, setOffline] = useState(false);
  const loadedRef = useRef(false);

  const today = new Date().toISOString().split('T')[0];
  const dateDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!loadedRef.current) setStatus('loading');

    try {
      // Prayers due today. Missed scheduled prayers remain here instead of disappearing.
      const scheduledRes = await supabase
        .from('prayers')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .lte('schedule_date', today)
        .eq('status', 'active')
        .not('schedule_date', 'is', null)
        .order('schedule_date', { ascending: true })
        .order('schedule_time', { ascending: true });
      if (scheduledRes.error) throw scheduledRes.error;
      setForToday(scheduledRes.data || []);

      // Today's completed sessions
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const sessionsRes = await supabase
        .from('sessions')
        .select('*, prayer:prayers(*)')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false });
      if (sessionsRes.error) throw sessionsRes.error;
      setPrayedToday(sessionsRes.data || []);

      const countRes = await supabase
        .from('prayers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('deleted_at', null);
      if (countRes.error) throw countRes.error;
      setHasPrayers((countRes.count || 0) > 0);

      loadedRef.current = true;
      setStatus('ready');
    } catch (error) {
      // Once we have content on screen, keep it and just flag the refresh failure;
      // only take over the screen with an error view on the very first load.
      if (loadedRef.current) showError(isOfflineError(error) ? "You're offline" : "Couldn't refresh");
      else { setOffline(isOfflineError(error)); setStatus('error'); }
    }
  }, [user, today, showError]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatSessionTime = (createdAt: string) =>
    new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sec`;
    return `${Math.round(seconds / 60)} min`;
  };

  const nothingToday = forToday.length === 0 && prayedToday.length === 0;

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <LoadingState />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <ErrorState offline={offline} onRetry={fetchData} />
      </View>
    );
  }

  return (
    <SwipeTabs onLeft={() => router.push('/(tabs)/library')}>
    <View style={styles.container}>
      {/* Top bar — Today is the home base for the user's practice. The avatar
          opens "Your practice" (stats); the gear opens Settings. These live here
          only, not on Prayers, which is purely the content library. */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        <Pressable style={styles.avatar} onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Your practice">
          <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() || 'A'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings">
          <Settings size={20} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.quiet} />}
      >
        <ScreenTitle title="Today" subtitle={dateDisplay} style={styles.hero} />

        {!hasPrayers && nothingToday && (
          <View style={styles.section}>
            <Card onPress={() => router.push('/add-prayer')} style={styles.firstPrayerCard}>
              <Text style={styles.cardTitle}>Add your first prayer when you're ready</Text>
            </Card>
          </View>
        )}

        {hasPrayers && nothingToday && (
          <View style={styles.calmEmpty}>
            <Text style={styles.calmText}>Nothing scheduled for today</Text>
            <Text style={styles.calmSub}>Find any prayer under Prayers</Text>
          </View>
        )}

        {forToday.length > 0 && (
          <View style={styles.section}>
            <Kicker style={styles.sectionKicker}>For today</Kicker>
            <View style={styles.cardStack}>
              {forToday.map((prayer) => {
                const secondary = buildSecondary(prayer);
                return (
                  <Card
                    key={prayer.id}
                    onPress={() => router.push({ pathname: '/prayer/[id]', params: { id: prayer.id } })}
                    style={styles.tile}
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{prayer.title}</Text>
                      {secondary.length > 0 && (
                        <Text style={styles.cardMeta} numberOfLines={1}>{secondary}</Text>
                      )}
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.prayChip, pressed && styles.prayChipPressed]}
                      onPress={() => router.push(prayRoute(prayer))}
                      accessibilityRole="button"
                      accessibilityLabel={`Pray for ${prayer.title}`}
                    >
                      <Text style={styles.prayChipText} maxFontSizeMultiplier={1.5}>Pray</Text>
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        {prayedToday.length > 0 && (
          <View style={styles.section}>
            <Kicker style={styles.sectionKicker}>Prayed today</Kicker>
            <View style={styles.cardStack}>
              {prayedToday.map((session) => {
                const prayer = (session as any).prayer as Prayer | undefined;
                const title = prayer?.title || 'Untitled session';
                const completedMeta = `${formatSessionTime(session.created_at)} · ${formatDuration(session.duration_seconds)}`;

                return (
                  <Card
                    key={session.id}
                    onPress={() => {
                      if (session.prayer_id) router.push({ pathname: '/prayer/[id]', params: { id: session.prayer_id } });
                    }}
                    style={styles.tile}
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.prayedTitle} numberOfLines={1}>{title}</Text>
                      <GhostPill label={completedMeta} style={styles.prayedPill} />
                    </View>
                    <View style={styles.checkCircle}>
                      <Check size={13} color={colors.quiet} />
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
    </SwipeTabs>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    // paddingTop is applied inline from safe-area insets.
    paddingBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
    color: colors.muted,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  hero: { paddingHorizontal: spacing.lg, paddingTop: 8, marginBottom: 18 },
  section: { paddingHorizontal: spacing.lg, marginBottom: 18 },
  sectionKicker: { marginBottom: 12, marginLeft: 4 },
  cardStack: { gap: 10 },
  firstPrayerCard: { alignItems: 'flex-start' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingHorizontal: 18,
  },
  cardContent: { flex: 1, marginRight: 12 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink, letterSpacing: -0.2 },
  cardMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 4 },
  prayChip: { backgroundColor: colors.selectedBg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill },
  prayChipPressed: { opacity: 0.8 },
  prayChipText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.selectedText, letterSpacing: -0.1 },
  prayedTitle: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.muted, letterSpacing: -0.2 },
  prayedPill: { marginTop: 8 },
  // A quiet "done" marker — completion shouldn't compete for attention.
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  calmEmpty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl, alignItems: 'center', gap: 6 },
  calmText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
  calmSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.quiet },
});
