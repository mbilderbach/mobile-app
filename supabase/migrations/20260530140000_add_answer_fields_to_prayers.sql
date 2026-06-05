/*
  # Capture answered prayers

  Answered prayers are the payoff of the practice. These fields let the app
  retire a prayer while preserving the testimony / answer note.
*/

ALTER TABLE prayers ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE prayers ADD COLUMN IF NOT EXISTS answer_note text;

CREATE INDEX IF NOT EXISTS idx_prayers_answered_at
  ON prayers(user_id, answered_at)
  WHERE answered_at IS NOT NULL;
