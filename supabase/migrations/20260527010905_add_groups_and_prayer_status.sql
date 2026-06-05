/*
  # Add groups, prayer status, urgency, and neglect tracking

  1. New Tables
    - `groups`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, required)
      - `color` (text, preset color key)
      - `emoji` (text, optional)
      - `created_at` (timestamptz)
    - `prayer_groups` (junction table)
      - `prayer_id` (uuid, references prayers)
      - `group_id` (uuid, references groups)

  2. Modified Tables
    - `prayers`
      - `status` (text: 'unrefined', 'active', 'answered', 'archived')
      - `urgency` (text: 'low', 'normal', 'urgent')
      - `neglect_threshold_days` (integer, per-prayer override)
      - `last_prayed_at` (timestamptz, updated when a session is logged)

  3. Security
    - Enable RLS on groups and prayer_groups
    - Users can only access their own groups
    - prayer_groups restricted via ownership of both prayer and group
*/

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'stone',
  emoji text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own groups"
  ON groups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own groups"
  ON groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own groups"
  ON groups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);

-- Prayer-Groups junction table
CREATE TABLE IF NOT EXISTS prayer_groups (
  prayer_id uuid NOT NULL REFERENCES prayers(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (prayer_id, group_id)
);

ALTER TABLE prayer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prayer_groups"
  ON prayer_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prayers
      WHERE prayers.id = prayer_groups.prayer_id
      AND prayers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own prayer_groups"
  ON prayer_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prayers
      WHERE prayers.id = prayer_groups.prayer_id
      AND prayers.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = prayer_groups.group_id
      AND groups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own prayer_groups"
  ON prayer_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prayers
      WHERE prayers.id = prayer_groups.prayer_id
      AND prayers.user_id = auth.uid()
    )
  );

-- Add new columns to prayers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prayers' AND column_name = 'status'
  ) THEN
    ALTER TABLE prayers ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prayers' AND column_name = 'urgency'
  ) THEN
    ALTER TABLE prayers ADD COLUMN urgency text NOT NULL DEFAULT 'normal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prayers' AND column_name = 'neglect_threshold_days'
  ) THEN
    ALTER TABLE prayers ADD COLUMN neglect_threshold_days integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prayers' AND column_name = 'last_prayed_at'
  ) THEN
    ALTER TABLE prayers ADD COLUMN last_prayed_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prayers_status ON prayers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_prayers_last_prayed ON prayers(user_id, last_prayed_at);
