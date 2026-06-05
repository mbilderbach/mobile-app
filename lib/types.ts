export interface Prayer {
  id: string;
  user_id: string;
  title: string;
  description: string;
  /** When true, `description` is read aloud in the Pray-along teleprompter. */
  read_along: boolean;
  schedule_date: string | null;
  schedule_time: string | null;
  recurrence: string;
  recurrence_rule: string | null;
  next_fire: string | null;
  notification_id: string | null;
  is_library: boolean;
  status: 'unrefined' | 'active' | 'answered' | 'archived';
  answered_at: string | null;
  answer_note: string | null;
  neglect_threshold_days: number | null;
  last_prayed_at: string | null;
  /** Soft-delete marker — non-null means the prayer is in the trash (recoverable via undo). */
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  prayer_id: string | null;
  duration_seconds: number;
  reflection: string;
  created_at: string;
}

export interface Group {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string | null;
  created_at: string;
}

export interface PrayerGroup {
  prayer_id: string;
  group_id: string;
}

/* ── Together — Circles & shared prayer ───────────────────────────────────── */

/** A private, invite-only group. 'community' is the scaled sibling, built later. */
export interface Circle {
  id: string;
  name: string;
  kind: 'circle' | 'community';
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  role: 'leader' | 'member';
  display_name: string;
  muted: boolean;
  joined_at: string;
}

export type SharedPrayerStatus = 'open' | 'answered' | 'withdrawn';

/**
 * A request as read from the `shared_prayer_cards` view. For an anonymous
 * request shared by someone else, `owner_id`/`owner_name` are masked to null by
 * the database — the client never receives the asker's identity.
 */
export interface SharedPrayerCard {
  id: string;
  circle_id: string;
  title: string;
  body: string | null;
  category: string | null;
  moment_at: string | null;
  status: SharedPrayerStatus;
  answered_at: string | null;
  gratitude_note: string | null;
  created_at: string;
  anonymous: boolean;
  is_mine: boolean;
  owner_id: string | null;
  owner_name: string | null;
  /** Number of people praying for this request — assurance, never a score. */
  carry_count: number;
  /** Whether the current user is already carrying it. */
  i_carried: boolean;
}

/** A carrier of a request (from `carry_cards`) — the named-assurance unit. */
export interface CarryCard {
  shared_prayer_id: string;
  user_id: string;
  carrier_name: string | null;
  is_me: boolean;
  said_with_you: boolean;
  carried_at: string;
}

/** An owner-posted update (only the owner can write these). */
export interface SharedPrayerUpdate {
  id: string;
  shared_prayer_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

/** Someone who plans to pray at the request's moment (from `carry_reminder_cards`). */
export interface CarryReminderCard {
  shared_prayer_id: string;
  user_id: string;
  member_name: string | null;
  is_me: boolean;
  remind_at: string;
}

export const GROUP_COLORS = {
  stone: '#78716c',
  amber: '#b45309',
  emerald: '#047857',
  sky: '#0369a1',
  rose: '#be123c',
  slate: '#334155',
} as const;

export type GroupColorKey = keyof typeof GROUP_COLORS;
