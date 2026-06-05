/**
 * Together — the Circle home.
 *
 * Two states:
 *   - No circle yet → a warm welcome with Create / Join.
 *   - In a circle → masthead (name, member avatars, live presence line) over a
 *     stream of requests: open ones to carry, answered+gratitude kept cards.
 *
 * Denser than the personal Today screen on purpose — the fullness is other
 * people being present. Presence, not metrics: the only number anywhere is
 * "N praying", which is assurance, never a score.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Users, ChevronDown } from 'lucide-react-native';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenTitle, Kicker, PrimaryButton, SecondaryButton } from '@/components/ui';
import { LoadingState, ErrorState, type LoadStatus } from '@/components/ScreenState';
import { AvatarCluster, RequestCard } from '@/components/circle/CircleBits';
import {
  listMyCircles,
  listMembers,
  listRequests,
  listCarriers,
  assuranceLine,
} from '@/lib/circles';
import type { Circle, CircleMember, SharedPrayerCard } from '@/lib/types';

export default function TogetherScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [circles, setCircles] = useState<(Circle & { role: string; muted: boolean })[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [requests, setRequests] = useState<SharedPrayerCard[]>([]);
  // Per-request assurance line, keyed by request id.
  const [assurance, setAssurance] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const active = circles.find((c) => c.id === activeId) || null;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const mine = await listMyCircles();
      setCircles(mine);
      if (mine.length === 0) { setStatus('ready'); return; }

      // Keep the current selection if still valid, else default to the first.
      const current = mine.find((c) => c.id === activeId) || mine[0];
      setActiveId(current.id);

      const [mem, reqs] = await Promise.all([listMembers(current.id), listRequests(current.id)]);
      setMembers(mem);
      setRequests(reqs);

      // Assurance lines for open requests (answered cards show a kept count instead).
      const open = reqs.filter((r) => r.status === 'open');
      const lines: Record<string, string> = {};
      await Promise.all(
        open.map(async (r) => {
          const carriers = await listCarriers(r.id);
          lines[r.id] = assuranceLine(carriers);
        }),
      );
      setAssurance(lines);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [user, activeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openRequests = requests.filter((r) => r.status === 'open');
  const answeredRequests = requests.filter((r) => r.status === 'answered');

  // ── No circle yet ──────────────────────────────────────────────────────────
  if (status === 'ready' && circles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 14, 36) }]}>
          <ScreenTitle title="Together" size="page" />
        </View>
        <ScrollView contentContainerStyle={styles.welcomeContent}>
          <View style={styles.welcomeCard}>
            <View style={styles.iconWrap}><Users size={26} color={colors.selectedText} /></View>
            <Text style={styles.welcomeTitle}>Pray together</Text>
            <Text style={styles.welcomeBody}>
              A circle is a small, private group — family, a couple, a few friends. Share what’s
              on your heart and carry each other’s prayers. No feeds, no likes, no noise. Just
              presence.
            </Text>
            <PrimaryButton label="Create a circle" onPress={() => router.push('/circle-create')} style={styles.welcomeBtn} />
            <SecondaryButton label="Join with a code" onPress={() => router.push('/circle-join')} style={styles.welcomeBtn} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 14, 36) }]}>
        <Pressable
          style={styles.circleSwitch}
          onPress={() => router.push('/circle-settings')}
          accessibilityRole="button"
          accessibilityLabel="Circle settings"
        >
          <Text style={styles.circleName} numberOfLines={1}>{active?.name || 'Together'}</Text>
          <ChevronDown size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          style={styles.shareBtn}
          onPress={() => activeId && router.push({ pathname: '/circle-share', params: { circleId: activeId } })}
          accessibilityRole="button"
          accessibilityLabel="Share a prayer with your circle"
        >
          <Plus size={20} color={colors.onPrimary} />
        </Pressable>
      </View>

      {status === 'loading' ? (
        <LoadingState />
      ) : status === 'error' ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.quiet} />}
        >
          {/* Masthead — who's here */}
          <View style={styles.masthead}>
            <AvatarCluster names={members.map((m) => m.display_name)} />
            <Text style={styles.mastheadMeta}>
              {members.length} {members.length === 1 ? 'person' : 'people'} in this circle
            </Text>
          </View>

          {/* Welcome state for an empty circle */}
          {requests.length === 0 && (
            <View style={styles.firstWrap}>
              <Text style={styles.firstTitle}>Your circle is ready.</Text>
              <Text style={styles.firstBody}>
                Share the first prayer — a need, a hope, a moment you want others to hold with you.
              </Text>
              <PrimaryButton
                label="Share a prayer"
                onPress={() => activeId && router.push({ pathname: '/circle-share', params: { circleId: activeId } })}
                style={styles.firstBtn}
              />
              <Text style={styles.inviteHint}>Invite others with the code in circle settings.</Text>
            </View>
          )}

          {openRequests.length > 0 && (
            <View style={styles.section}>
              <Kicker style={styles.sectionKicker}>Open</Kicker>
              <View style={styles.cardStack}>
                {openRequests.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    assurance={assurance[r.id] || 'Be the first to pray'}
                    onPress={() => router.push({ pathname: '/circle-request', params: { id: r.id } })}
                  />
                ))}
              </View>
            </View>
          )}

          {answeredRequests.length > 0 && (
            <View style={styles.section}>
              <Kicker style={styles.sectionKicker}>Answered · kept</Kicker>
              <View style={styles.cardStack}>
                {answeredRequests.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    assurance=""
                    onPress={() => router.push({ pathname: '/circle-request', params: { id: r.id } })}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: spacing.lg, paddingBottom: 8 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    gap: 12,
  },
  circleSwitch: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  circleName: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.6 },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  masthead: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 18,
    gap: 10,
  },
  mastheadMeta: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
  section: { paddingHorizontal: spacing.lg, marginBottom: 18 },
  sectionKicker: { marginBottom: 12, marginLeft: 4 },
  cardStack: { gap: 12 },

  // Welcome (no circle)
  welcomeContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingBottom: 80 },
  welcomeCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 28, alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.selectedBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  welcomeTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
  welcomeBody: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  welcomeBtn: { alignSelf: 'stretch' },

  // First request (empty circle)
  firstWrap: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 24, gap: 10, alignItems: 'center' },
  firstTitle: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink, letterSpacing: -0.3 },
  firstBody: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  firstBtn: { alignSelf: 'stretch', marginTop: 6 },
  inviteHint: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.quiet, marginTop: 4 },
});
