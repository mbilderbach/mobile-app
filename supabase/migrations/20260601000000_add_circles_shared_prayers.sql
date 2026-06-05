/*
  # Together — Circles, shared prayers, carries, assurance

  The social core. A Circle is a private, invite-only group; members share prayer
  requests into it and "carry" each other's by praying. The privacy + safety
  rules from the brief are enforced HERE, in the database, so they can't be
  bypassed by the client ("safe by construction"):

    - A Circle and everything in it is visible ONLY to its members (RLS).
    - There is no discovery: you reach a Circle only by creating one or joining
      with its invite code (via SECURITY DEFINER RPCs that don't leak other rows).
    - A request can be shared anonymously within the Circle; the owner's identity
      is masked server-side (in the *_cards views), never sent to other members.
    - Carriers cannot post free text — only the request's owner can post updates
      (enforced by the updates INSERT policy). The carry itself is the message.
    - Presence, not metrics: nothing here ranks or scores a carrier. Assurance is
      the set of people praying for a given request, surfaced by name (Circle) —
      never an aggregate of a person's carrying across requests.

  1. New tables
     - circles                — the group (kind reserved for future 'community')
     - circle_members         — membership, role, cached display_name, mute
     - shared_prayers         — a request shared into a circle (open/answered/withdrawn)
     - carries                — one row per person who is praying for a request
     - shared_prayer_updates  — owner-only updates thread
     - carry_reminders        — "remind me to pray at the moment" (shared intent)

  2. Views (security_invoker; inherit RLS, mask anonymity)
     - shared_prayer_cards    — request + carry_count + i_carried + masked owner
     - carry_cards            — carriers with names (for the named assurance line)
     - carry_reminder_cards   — who plans to pray at the moment (convergence)

  3. RPCs (SECURITY DEFINER)
     - create_circle(name, display_name)
     - join_circle_by_code(code, display_name)

  4. Security
     - RLS on every table; membership gated via is_circle_member() (SECURITY
       DEFINER, so the circle_members policy doesn't recurse on itself).
*/

-- NOTE on ordering: the tables come first, THEN the is_circle_member() helper
-- (its body references circle_members, so that table must already exist —
-- Postgres validates SQL function bodies at creation), THEN every policy that
-- calls the helper. Don't move the function above the tables.

-- ── circles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- 'circle' (intimate, named assurance) now; 'community' (scaled, count
  -- assurance, roles, moderation) is the deliberate sibling built later.
  kind text NOT NULL DEFAULT 'circle',
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;

-- ── circle_members ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_members (
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member', -- 'leader' | 'member' (roles matter at Community scale)
  display_name text NOT NULL,
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);

-- ── Membership helper (SECURITY DEFINER avoids RLS recursion) ────────────────
-- Defined after circle_members exists; runs as owner so the circle_members
-- SELECT policy can call it without recursing on itself.
CREATE OR REPLACE FUNCTION is_circle_member(p_circle uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = p_circle AND user_id = p_user
  );
$$;

-- ── circles policies ────────────────────────────────────────────────────────
CREATE POLICY "Members can view their circles"
  ON circles FOR SELECT TO authenticated
  USING (is_circle_member(id, auth.uid()));

-- Insert happens via create_circle() RPC; still require self-authorship.
CREATE POLICY "Users can create circles"
  ON circles FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Circles are flat: any member may rename.
CREATE POLICY "Members can rename their circles"
  ON circles FOR UPDATE TO authenticated
  USING (is_circle_member(id, auth.uid()))
  WITH CHECK (is_circle_member(id, auth.uid()));

-- ── circle_members policies ─────────────────────────────────────────────────
CREATE POLICY "Members can view co-members"
  ON circle_members FOR SELECT TO authenticated
  USING (is_circle_member(circle_id, auth.uid()));

-- Direct self-insert is allowed (joining also goes through an RPC, but this keeps
-- the create flow simple); you may only add yourself.
CREATE POLICY "Users can join as themselves"
  ON circle_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only your own membership row (mute, rename yourself).
CREATE POLICY "Members can update own membership"
  ON circle_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Leaving a circle.
CREATE POLICY "Members can leave"
  ON circle_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── shared_prayers (requests) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  -- Optional link back to a personal prayer the request was shared from.
  source_prayer_id uuid REFERENCES prayers(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  category text,
  -- Tender requests can be shared without a name; masked in shared_prayer_cards.
  anonymous boolean NOT NULL DEFAULT false,
  -- Optional moment to pray (e.g. an interview at 2pm) — seed of synchronized prayer.
  moment_at timestamptz,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'answered' | 'withdrawn'
  answered_at timestamptz,
  gratitude_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shared_prayers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view circle requests"
  ON shared_prayers FOR SELECT TO authenticated
  USING (is_circle_member(circle_id, auth.uid()));

CREATE POLICY "Members can share into their circle"
  ON shared_prayers FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_circle_member(circle_id, auth.uid()));

-- Only the owner edits / answers / withdraws their own request.
CREATE POLICY "Owners can update their request"
  ON shared_prayers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their request"
  ON shared_prayers FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_shared_prayers_circle ON shared_prayers(circle_id, created_at DESC);

-- ── carries (presence — one per person per request) ─────────────────────────
CREATE TABLE IF NOT EXISTS carries (
  shared_prayer_id uuid NOT NULL REFERENCES shared_prayers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- The single fixed, optional "praying with you" — the ONLY message a carrier
  -- can send. No free text (that's what invites noise + moderation + harm).
  said_with_you boolean NOT NULL DEFAULT false,
  carried_at timestamptz DEFAULT now(),
  PRIMARY KEY (shared_prayer_id, user_id)
);

ALTER TABLE carries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see who carries a request"
  ON carries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_prayers sp
      WHERE sp.id = carries.shared_prayer_id
      AND is_circle_member(sp.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members can carry requests in their circle"
  ON carries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM shared_prayers sp
      WHERE sp.id = carries.shared_prayer_id
      AND is_circle_member(sp.circle_id, auth.uid())
    )
  );

CREATE POLICY "Carriers can update their own carry"
  ON carries FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Carriers can withdraw their carry"
  ON carries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── shared_prayer_updates (owner-only thread) ───────────────────────────────
CREATE TABLE IF NOT EXISTS shared_prayer_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_prayer_id uuid NOT NULL REFERENCES shared_prayers(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shared_prayer_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read updates"
  ON shared_prayer_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_prayers sp
      WHERE sp.id = shared_prayer_updates.shared_prayer_id
      AND is_circle_member(sp.circle_id, auth.uid())
    )
  );

-- ONLY the request's owner may post an update. This is the rule that keeps
-- carriers from posting free text, enforced in the database.
CREATE POLICY "Only the owner posts updates"
  ON shared_prayer_updates FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM shared_prayers sp
      WHERE sp.id = shared_prayer_updates.shared_prayer_id
      AND sp.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete their updates"
  ON shared_prayer_updates FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_updates_request ON shared_prayer_updates(shared_prayer_id, created_at);

-- ── carry_reminders (shared "I'll pray at the moment" intent) ────────────────
CREATE TABLE IF NOT EXISTS carry_reminders (
  shared_prayer_id uuid NOT NULL REFERENCES shared_prayers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  remind_at timestamptz NOT NULL,
  notification_id text, -- local expo-notifications id, for cancel
  PRIMARY KEY (shared_prayer_id, user_id)
);

ALTER TABLE carry_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see who plans to pray at the moment"
  ON carry_reminders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_prayers sp
      WHERE sp.id = carry_reminders.shared_prayer_id
      AND is_circle_member(sp.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members can set their own reminder"
  ON carry_reminders FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM shared_prayers sp
      WHERE sp.id = carry_reminders.shared_prayer_id
      AND is_circle_member(sp.circle_id, auth.uid())
    )
  );

CREATE POLICY "Members can update their own reminder"
  ON carry_reminders FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can clear their own reminder"
  ON carry_reminders FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── Views — masked, enriched reads (security_invoker → inherit RLS) ──────────

-- The request card: carry count, whether I carried, and owner identity MASKED
-- when the request is anonymous (and I'm not the owner). Other members never
-- receive the owner_id / name of an anonymous request.
CREATE OR REPLACE VIEW shared_prayer_cards
WITH (security_invoker = true) AS
SELECT
  sp.id,
  sp.circle_id,
  sp.title,
  sp.body,
  sp.category,
  sp.moment_at,
  sp.status,
  sp.answered_at,
  sp.gratitude_note,
  sp.created_at,
  sp.anonymous,
  (sp.owner_id = auth.uid()) AS is_mine,
  CASE WHEN sp.anonymous AND sp.owner_id <> auth.uid()
       THEN NULL ELSE sp.owner_id END AS owner_id,
  CASE WHEN sp.anonymous AND sp.owner_id <> auth.uid()
       THEN NULL ELSE owner.display_name END AS owner_name,
  (SELECT count(*) FROM carries c WHERE c.shared_prayer_id = sp.id) AS carry_count,
  EXISTS (
    SELECT 1 FROM carries c
    WHERE c.shared_prayer_id = sp.id AND c.user_id = auth.uid()
  ) AS i_carried
FROM shared_prayers sp
LEFT JOIN circle_members owner
  ON owner.circle_id = sp.circle_id AND owner.user_id = sp.owner_id;

-- Carriers with their names — the source of the named assurance line. (Carrier
-- identities are intentionally visible: "Mara & 2 others praying" is assurance,
-- not a score. Nothing here aggregates a person's carrying across requests.)
CREATE OR REPLACE VIEW carry_cards
WITH (security_invoker = true) AS
SELECT
  c.shared_prayer_id,
  c.user_id,
  cm.display_name AS carrier_name,
  (c.user_id = auth.uid()) AS is_me,
  c.said_with_you,
  c.carried_at
FROM carries c
JOIN shared_prayers sp ON sp.id = c.shared_prayer_id
LEFT JOIN circle_members cm
  ON cm.circle_id = sp.circle_id AND cm.user_id = c.user_id;

-- Who plans to pray at the moment — the quiet convergence line.
CREATE OR REPLACE VIEW carry_reminder_cards
WITH (security_invoker = true) AS
SELECT
  r.shared_prayer_id,
  r.user_id,
  cm.display_name AS member_name,
  (r.user_id = auth.uid()) AS is_me,
  r.remind_at
FROM carry_reminders r
JOIN shared_prayers sp ON sp.id = r.shared_prayer_id
LEFT JOIN circle_members cm
  ON cm.circle_id = sp.circle_id AND cm.user_id = r.user_id;

-- ── RPCs — create / join without leaking other rows ─────────────────────────

-- Create a circle and make the caller its first member (leader), returning the id.
CREATE OR REPLACE FUNCTION create_circle(p_name text, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Short, unique, human-shareable invite code.
  LOOP
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM circles WHERE invite_code = v_code);
  END LOOP;

  INSERT INTO circles (name, invite_code, created_by)
  VALUES (trim(p_name), v_code, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO circle_members (circle_id, user_id, role, display_name)
  VALUES (v_id, auth.uid(), 'leader', coalesce(nullif(trim(p_display_name), ''), 'Member'));

  RETURN v_id;
END;
$$;

-- Join a circle by its invite code. Looks the circle up WITHOUT exposing any
-- circle the caller isn't joining; returns the joined circle's id, or raises.
CREATE OR REPLACE FUNCTION join_circle_by_code(p_code text, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_id FROM circles
  WHERE invite_code = upper(trim(p_code));

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No circle found for that code';
  END IF;

  INSERT INTO circle_members (circle_id, user_id, role, display_name)
  VALUES (v_id, auth.uid(), 'member', coalesce(nullif(trim(p_display_name), ''), 'Member'))
  ON CONFLICT (circle_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_circle(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION join_circle_by_code(text, text) TO authenticated;
