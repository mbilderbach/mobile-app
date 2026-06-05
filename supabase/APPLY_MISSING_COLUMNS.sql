/*
  Run this ONCE in your Supabase project → SQL Editor → New query → paste → Run.

  Your live database is missing 5 columns that the app's code needs (the
  migrations from `read_along` onward were never applied). This is why
  "Pray now", Today, and Browse fail with "Couldn't load" / schema-cache errors.

  Every statement is idempotent (IF NOT EXISTS), so it is safe to run more than
  once. It only adds columns/indexes — it never drops or rewrites data.
*/

-- 1. Pray-along read-along flag
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS read_along boolean NOT NULL DEFAULT false;

-- 2. Local notification identifier (for cancel/reschedule)
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS notification_id text;
CREATE INDEX IF NOT EXISTS idx_prayers_notification_id
  ON prayers(user_id, notification_id)
  WHERE notification_id IS NOT NULL;

-- 3. Answered prayers (testimony)
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS answer_note text;
CREATE INDEX IF NOT EXISTS idx_prayers_answered_at
  ON prayers(user_id, answered_at)
  WHERE answered_at IS NOT NULL;

-- 4. Soft delete + undo
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_prayers_live
  ON prayers(user_id, status)
  WHERE deleted_at IS NULL;

-- 5. Refresh PostgREST's schema cache so the new columns are visible immediately.
NOTIFY pgrst, 'reload schema';
