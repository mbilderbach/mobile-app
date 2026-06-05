/*
  # Add read_along flag to prayers

  Adds a boolean that marks whether a prayer's `description` should be read
  aloud in the Pray-along teleprompter. Defaults to false so existing notes /
  context are treated as private (not scrolled during prayer) until the user
  opts a prayer in.

  1. Changes
    - `prayers.read_along` (boolean, not null, default false)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prayers' AND column_name = 'read_along'
  ) THEN
    ALTER TABLE prayers ADD COLUMN read_along boolean NOT NULL DEFAULT false;
  END IF;
END $$;
