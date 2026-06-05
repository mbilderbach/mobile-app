/**
 * Small shared Together primitives: member avatars and a request card.
 *
 * Kept here so the feed, detail, and answered states render requests
 * identically. Everything is presence-first — no counts-as-score, no carrier
 * credit; the only number shown is "N praying", which is assurance.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Clock } from 'lucide-react-native';
import { fonts, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { SharedPrayerCard } from '@/lib/types';

export function initialOf(name?: string | null): string {
  return (name?.trim()?.[0] || '·').toUpperCase();
}

/** A small circular initial avatar. */
export function Avatar({ name, size = 32, dim }: { name?: string | null; size?: number; dim?: boolean }) {
  const colors = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, dim && s.avatarDim]}>
      <Text style={[s.avatarText, { fontSize: size * 0.42 }]}>{initialOf(name)}</Text>
    </View>
  );
}

/** Overlapping cluster of member avatars (the masthead "who's here"). */
export function AvatarCluster({ names, max = 5, size = 32 }: { names: (string | null)[]; max?: number; size?: number }) {
  const colors = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <View style={s.cluster}>
      {shown.map((n, i) => (
        <View key={i} style={[s.clusterItem, { marginLeft: i === 0 ? 0 : -size * 0.32 }]}>
          <Avatar name={n} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View style={[s.clusterItem, s.moreChip, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.32 }]}>
          <Text style={s.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

function momentLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (sameDay) return `Today ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

/**
 * A request card in the feed. `assurance` is the pre-computed presence line.
 * Answered requests settle into a kept warm state rather than disappearing.
 */
export function RequestCard({
  request,
  assurance,
  onPress,
}: {
  request: SharedPrayerCard;
  assurance: string;
  onPress: () => void;
}) {
  const colors = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const answered = request.status === 'answered';
  const who = request.anonymous ? 'Someone' : request.owner_name || (request.is_mine ? 'You' : 'Someone');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, answered && s.cardAnswered, pressed && s.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={request.title}
    >
      <View style={s.cardHead}>
        <Text style={s.who} numberOfLines={1}>{who}{request.is_mine ? ' · you' : ''}</Text>
        {answered ? (
          <View style={s.answeredTag}>
            <Check size={12} color={colors.quiet} />
            <Text style={s.answeredTagText}>Answered</Text>
          </View>
        ) : null}
      </View>

      <Text style={s.title} numberOfLines={2}>{request.title}</Text>

      {request.moment_at && !answered ? (
        <View style={s.momentRow}>
          <Clock size={13} color={colors.quiet} />
          <Text style={s.momentText}>{momentLabel(request.moment_at)}</Text>
        </View>
      ) : null}

      {answered && request.gratitude_note ? (
        <Text style={s.gratitude} numberOfLines={3}>“{request.gratitude_note}”</Text>
      ) : null}

      <Text style={[s.assurance, answered && s.assuranceAnswered]} numberOfLines={1}>
        {answered ? `${request.carry_count} carried this` : assurance}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  avatar: { backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  avatarDim: { backgroundColor: colors.fill },
  avatarText: { fontFamily: fonts.sansSemiBold, color: colors.selectedText },
  cluster: { flexDirection: 'row', alignItems: 'center' },
  clusterItem: { borderWidth: 2, borderColor: colors.paper, borderRadius: 999 },
  moreChip: { backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.muted },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    gap: 8,
    ...shadow.card,
  },
  cardAnswered: {
    backgroundColor: colors.selectedBg,
  },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.994 }] },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted, letterSpacing: -0.1, flex: 1 },
  answeredTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  answeredTagText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.quiet, letterSpacing: 0.2, textTransform: 'uppercase' },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.ink, letterSpacing: -0.3, lineHeight: 23 },
  momentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  momentText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.quiet, letterSpacing: -0.1 },
  gratitude: { fontFamily: fonts.serifItalic, fontSize: 14.5, color: colors.inkSoft, lineHeight: 21 },
  assurance: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.selectedText, letterSpacing: -0.1, marginTop: 2 },
  assuranceAnswered: { color: colors.quiet },
});
