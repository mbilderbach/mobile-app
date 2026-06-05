import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Flame, Clock, Calendar, TrendingUp } from 'lucide-react-native';
import { fonts, spacing, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenTitle, Kicker, Card } from '@/components/ui';

export default function ProfileScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [thisMonthSessions, setThisMonthSessions] = useState(0);
  const [topPrayers, setTopPrayers] = useState<{ title: string; count: number }[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: allSessions } = await supabase
      .from('sessions')
      .select('created_at, duration_seconds, prayer_id, prayers(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!allSessions) return;

    setTotalSessions(allSessions.length);

    const totalSecs = allSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    setTotalMinutes(Math.round(totalSecs / 60));

    // Calculate streaks
    const daySet = new Set<string>();
    allSessions.forEach((s) => {
      daySet.add(new Date(s.created_at).toISOString().split('T')[0]);
    });
    const days = [...daySet].sort().reverse();

    let streak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (days[0] === todayStr || days[0] === yesterdayStr) {
      let checkDate = new Date(days[0]);
      for (const day of days) {
        const expected = checkDate.toISOString().split('T')[0];
        if (day === expected) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
    setCurrentStreak(streak);

    // Longest streak
    let longest = 0;
    let current = 1;
    const sortedDays = [...daySet].sort();
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        current++;
      } else {
        longest = Math.max(longest, current);
        current = 1;
      }
    }
    longest = Math.max(longest, current);
    setLongestStreak(sortedDays.length > 0 ? longest : 0);

    // This month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const monthSessions = allSessions.filter((s) => s.created_at >= startOfMonth);
    setThisMonthSessions(monthSessions.length);

    // Top prayers
    const counts: Record<string, { title: string; count: number }> = {};
    allSessions.forEach((s: any) => {
      if (s.prayer_id && s.prayers?.title) {
        if (!counts[s.prayer_id]) counts[s.prayer_id] = { title: s.prayers.title, count: 0 };
        counts[s.prayer_id].count++;
      }
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
    setTopPrayers(sorted);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ScreenTitle title="Your practice" size="page" style={styles.title} />

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Flame size={20} color={colors.muted} />
            <Text style={styles.statNumber}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </Card>
          <Card style={styles.statCard}>
            <Clock size={20} color={colors.muted} />
            <Text style={styles.statNumber}>{formatTime(totalMinutes)}</Text>
            <Text style={styles.statLabel}>Total prayed</Text>
          </Card>
          <Card style={styles.statCard}>
            <Calendar size={20} color={colors.muted} />
            <Text style={styles.statNumber}>{thisMonthSessions}</Text>
            <Text style={styles.statLabel}>This month</Text>
          </Card>
          <Card style={styles.statCard}>
            <TrendingUp size={20} color={colors.muted} />
            <Text style={styles.statNumber}>{longestStreak}</Text>
            <Text style={styles.statLabel}>Best streak</Text>
          </Card>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total sessions</Text>
          <Text style={styles.summaryValue}>{totalSessions}</Text>
        </View>

        {topPrayers.length > 0 && (
          <View style={styles.topSection}>
            <Kicker style={styles.sectionKicker}>Most returned to</Kicker>
            {topPrayers.map((p, i) => (
              <View key={i} style={styles.topRow}>
                <Text style={styles.topTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.topCount}>{p.count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    paddingBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  title: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    padding: 18,
    gap: 8,
  },
  statNumber: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
    marginBottom: 24,
  },
  summaryLabel: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.muted,
  },
  summaryValue: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
  },
  topSection: {
    gap: 0,
  },
  sectionKicker: {
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  topTitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    flex: 1,
    marginRight: 12,
  },
  topCount: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.muted,
  },
});
