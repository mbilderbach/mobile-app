/**
 * Together — data layer for Circles & shared prayer.
 *
 * Every Together screen goes through this module; it wraps the Supabase RPCs,
 * the masked card views, and the carry/update/reminder tables. The privacy and
 * safety rules live in the database (RLS + SECURITY DEFINER) — this layer simply
 * speaks to it. See supabase/migrations/20260601000000_add_circles_shared_prayers.sql.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { getPreferences } from '@/lib/preferences';
import type {
  Circle,
  CircleMember,
  SharedPrayerCard,
  CarryCard,
  SharedPrayerUpdate,
  CarryReminderCard,
} from '@/lib/types';

/* ── Circles ──────────────────────────────────────────────────────────────── */

/** Circles the current user belongs to, with their own membership row joined. */
export async function listMyCircles(): Promise<(Circle & { role: string; muted: boolean })[]> {
  const { data: memberships, error } = await supabase
    .from('circle_members')
    .select('role, muted, circle:circles(*)')
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (memberships || [])
    .map((m: any) => (m.circle ? { ...(m.circle as Circle), role: m.role, muted: m.muted } : null))
    .filter(Boolean) as (Circle & { role: string; muted: boolean })[];
}

export async function getCircle(circleId: string): Promise<Circle | null> {
  const { data, error } = await supabase.from('circles').select('*').eq('id', circleId).maybeSingle();
  if (error) throw error;
  return (data as Circle) || null;
}

export async function listMembers(circleId: string): Promise<CircleMember[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('*')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CircleMember[];
}

/** Create a circle (caller becomes leader). Returns the new circle id. */
export async function createCircle(name: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_circle', { p_name: name, p_display_name: displayName });
  if (error) throw error;
  return data as string;
}

/** Join by invite code. Returns the joined circle id; throws if the code is bad. */
export async function joinCircleByCode(code: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_circle_by_code', { p_code: code, p_display_name: displayName });
  if (error) throw error;
  return data as string;
}

export async function renameCircle(circleId: string, name: string): Promise<void> {
  const { error } = await supabase.from('circles').update({ name: name.trim() }).eq('id', circleId);
  if (error) throw error;
}

export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', userId);
  if (error) throw error;
}

export async function setMuted(circleId: string, userId: string, muted: boolean): Promise<void> {
  const { error } = await supabase
    .from('circle_members')
    .update({ muted })
    .eq('circle_id', circleId)
    .eq('user_id', userId);
  if (error) throw error;
}

/* ── Requests (shared prayers) ────────────────────────────────────────────── */

/** The circle feed: all requests as masked, enriched cards, newest first. */
export async function listRequests(circleId: string): Promise<SharedPrayerCard[]> {
  const { data, error } = await supabase
    .from('shared_prayer_cards')
    .select('*')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SharedPrayerCard[];
}

export async function getRequest(requestId: string): Promise<SharedPrayerCard | null> {
  const { data, error } = await supabase.from('shared_prayer_cards').select('*').eq('id', requestId).maybeSingle();
  if (error) throw error;
  return (data as SharedPrayerCard) || null;
}

export async function shareRequest(input: {
  circleId: string;
  ownerId: string;
  title: string;
  body?: string | null;
  category?: string | null;
  anonymous?: boolean;
  momentAt?: string | null;
  sourcePrayerId?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from('shared_prayers')
    .insert({
      circle_id: input.circleId,
      owner_id: input.ownerId,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      category: input.category || null,
      anonymous: !!input.anonymous,
      moment_at: input.momentAt || null,
      source_prayer_id: input.sourcePrayerId || null,
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.id as string;
}

/** Mark answered with an optional gratitude line — the request becomes a kept warm record. */
export async function answerRequest(requestId: string, gratitude?: string): Promise<void> {
  const { error } = await supabase
    .from('shared_prayers')
    .update({ status: 'answered', answered_at: new Date().toISOString(), gratitude_note: gratitude?.trim() || null })
    .eq('id', requestId);
  if (error) throw error;
}

/** Stop sharing — withdraw the request from the circle. */
export async function withdrawRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from('shared_prayers').update({ status: 'withdrawn' }).eq('id', requestId);
  if (error) throw error;
}

/* ── The carry (presence) ─────────────────────────────────────────────────── */

/** Begin carrying a request: "I'm praying for this." Idempotent. */
export async function carry(requestId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('carries')
    .upsert({ shared_prayer_id: requestId, user_id: userId }, { onConflict: 'shared_prayer_id,user_id' });
  if (error) throw error;
}

/** The single fixed, optional "praying with you" — the only message a carrier can send. */
export async function sayPrayingWithYou(requestId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('carries')
    .upsert(
      { shared_prayer_id: requestId, user_id: userId, said_with_you: true },
      { onConflict: 'shared_prayer_id,user_id' },
    );
  if (error) throw error;
}

export async function uncarry(requestId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('carries').delete().eq('shared_prayer_id', requestId).eq('user_id', userId);
  if (error) throw error;
}

/** Carriers of a request — the named assurance line ("Mara & 2 others praying"). */
export async function listCarriers(requestId: string): Promise<CarryCard[]> {
  const { data, error } = await supabase
    .from('carry_cards')
    .select('*')
    .eq('shared_prayer_id', requestId)
    .order('carried_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CarryCard[];
}

/* ── Updates (owner-only thread) ──────────────────────────────────────────── */

export async function listUpdates(requestId: string): Promise<SharedPrayerUpdate[]> {
  const { data, error } = await supabase
    .from('shared_prayer_updates')
    .select('*')
    .eq('shared_prayer_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as SharedPrayerUpdate[];
}

/** Post an update. The DB rejects this unless the caller is the request's owner. */
export async function postUpdate(requestId: string, authorId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('shared_prayer_updates')
    .insert({ shared_prayer_id: requestId, author_id: authorId, body: body.trim() });
  if (error) throw error;
}

/* ── Time-bound "remind me to pray then" (shared convergence) ─────────────── */

/** Members who plan to pray at the moment — the quiet "Mara & Joy plan to pray at 2:00 too." */
export async function listMomentReminders(requestId: string): Promise<CarryReminderCard[]> {
  const { data, error } = await supabase
    .from('carry_reminder_cards')
    .select('*')
    .eq('shared_prayer_id', requestId)
    .order('remind_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CarryReminderCard[];
}

async function ensureReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prayer-reminders', {
      name: 'Prayer reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  const requested = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true } });
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Toggle "remind me to pray at the moment." Records the shared intent (so the
 * circle can converge) and schedules a gentle local notification at the moment.
 */
export async function setMomentReminder(input: {
  requestId: string;
  userId: string;
  momentAt: string;
  ownerName: string | null;
}): Promise<void> {
  let notificationId: string | null = null;
  const when = new Date(input.momentAt);

  if (Platform.OS !== 'web' && getPreferences().reminders && when.getTime() > Date.now()) {
    const allowed = await ensureReminderPermission();
    if (allowed) {
      notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'A moment to pray',
          body: input.ownerName ? `Pray for ${input.ownerName} now` : 'Pray with your circle now',
          sound: false,
          data: { type: 'carry-moment', requestId: input.requestId },
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: when, channelId: 'prayer-reminders' },
      });
    }
  }

  const { error } = await supabase
    .from('carry_reminders')
    .upsert(
      { shared_prayer_id: input.requestId, user_id: input.userId, remind_at: input.momentAt, notification_id: notificationId },
      { onConflict: 'shared_prayer_id,user_id' },
    );
  if (error) throw error;
}

export async function clearMomentReminder(requestId: string, userId: string): Promise<void> {
  // Cancel the local notification first (best-effort), then drop the shared intent.
  const { data } = await supabase
    .from('carry_reminders')
    .select('notification_id')
    .eq('shared_prayer_id', requestId)
    .eq('user_id', userId)
    .maybeSingle();
  const notificationId = (data as any)?.notification_id as string | undefined;
  if (notificationId && Platform.OS !== 'web') {
    try { await Notifications.cancelScheduledNotificationAsync(notificationId); } catch { /* OS already dropped it */ }
  }
  const { error } = await supabase.from('carry_reminders').delete().eq('shared_prayer_id', requestId).eq('user_id', userId);
  if (error) throw error;
}

/* ── Assurance phrasing (presence, never a score) ─────────────────────────── */

/**
 * The named assurance line for a Circle: "Mara & 2 others praying", "You & Joy
 * praying", etc. Built from carrier names — never a leaderboard or a personal total.
 */
export function assuranceLine(carriers: CarryCard[]): string {
  if (carriers.length === 0) return 'Be the first to pray';
  const names = carriers.filter((c) => !c.is_me).map((c) => c.carrier_name || 'Someone');
  const iCarry = carriers.some((c) => c.is_me);

  if (iCarry && names.length === 0) return 'You’re praying for this';
  const lead = iCarry ? ['You', ...names] : names;

  if (lead.length === 1) return `${lead[0]} praying`;
  if (lead.length === 2) return `${lead[0]} & ${lead[1]} praying`;
  return `${lead[0]} & ${lead.length - 1} others praying`;
}
