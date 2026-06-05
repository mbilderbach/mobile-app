/*
  # Soft-delete for prayers

  Deleting a prayer used to be a hard DELETE that cascaded to its sessions and
  could not be undone. Instead we mark prayers with `deleted_at` and filter them
  out of every list, so a delete is reversible (Undo) and the prayer's session
  history is never destroyed.

  1. Changes
    - `prayers.deleted_at` (timestamptz, null = live, non-null = in the trash)

  2. Indexes
    - Partial index over live rows (deleted_at IS NULL) — the common read path.
*/

ALTER TABLE prayers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prayers_live
  ON prayers(user_id, status)
  WHERE deleted_at IS NULL;
