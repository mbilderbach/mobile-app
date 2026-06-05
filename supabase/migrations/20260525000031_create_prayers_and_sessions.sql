/*
  # Create prayers and sessions tables

  1. New Tables
    - `prayers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text, required)
      - `description` (text, optional)
      - `attachment_url` (text, optional photo URL)
      - `for_subject` (text, optional free-text subject)
      - `schedule_date` (date, optional)
      - `schedule_time` (time, optional)
      - `recurrence` (text, optional: none/daily/weekly/monthly/custom)
      - `recurrence_rule` (text, optional custom rule)
      - `next_fire` (timestamptz, computed next reminder)
      - `is_library` (boolean, whether saved to library)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `prayer_id` (uuid, references prayers, optional)
      - `duration_seconds` (integer, required)
      - `reflection` (text, optional)
      - `attachment_url` (text, optional photo URL)
      - `created_at` (timestamptz, when session was logged)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own prayers and sessions

  3. Indexes
    - prayers: user_id, schedule_date, for_subject
    - sessions: user_id, prayer_id, created_at
*/

CREATE TABLE IF NOT EXISTS prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text DEFAULT '',
  attachment_url text,
  for_subject text,
  schedule_date date,
  schedule_time time,
  recurrence text DEFAULT 'none',
  recurrence_rule text,
  next_fire timestamptz,
  is_library boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  prayer_id uuid REFERENCES prayers(id),
  duration_seconds integer NOT NULL DEFAULT 0,
  reflection text DEFAULT '',
  attachment_url text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prayers_user_id ON prayers(user_id);
CREATE INDEX IF NOT EXISTS idx_prayers_schedule_date ON prayers(user_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_prayers_for_subject ON prayers(user_id, for_subject);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_prayer_id ON sessions(prayer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(user_id, created_at);

-- RLS
ALTER TABLE prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Prayers policies
CREATE POLICY "Users can view own prayers"
  ON prayers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prayers"
  ON prayers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prayers"
  ON prayers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prayers"
  ON prayers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
