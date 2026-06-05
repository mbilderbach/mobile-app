/*
  # Store local notification identifiers for scheduled prayers

  Local notifications are scheduled on-device. We store the returned identifier
  so the app can cancel/reschedule cleanly when a reminder is edited, completed,
  or rolled forward by recurrence.
*/

ALTER TABLE prayers ADD COLUMN IF NOT EXISTS notification_id text;

CREATE INDEX IF NOT EXISTS idx_prayers_notification_id
  ON prayers(user_id, notification_id)
  WHERE notification_id IS NOT NULL;
