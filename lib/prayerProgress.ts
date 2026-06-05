import { supabase } from './supabase';
import { Prayer } from './types';
import { buildNextFire, nextDateAfterToday } from './schedule';
import { cancelPrayerNotification, reschedulePrayerNotification } from './notifications';

export async function updatePrayerAfterSession(prayerId: string) {
  const now = new Date().toISOString();

  const { data: prayer } = await supabase
    .from('prayers')
    .select('*')
    .eq('id', prayerId)
    .maybeSingle();

  if (!prayer) return;

  const p = prayer as Prayer;
  const update: Record<string, any> = {
    last_prayed_at: now,
    updated_at: now,
  };

  if (p.schedule_date) {
    if (p.recurrence && p.recurrence !== 'none') {
      const next = nextDateAfterToday(p.recurrence);
      const notificationId = await reschedulePrayerNotification({
        previousId: p.notification_id,
        title: p.title,
        scheduleDate: next,
        scheduleTime: p.schedule_time,
      });
      update.schedule_date = next;
      update.next_fire = buildNextFire(next, p.schedule_time);
      update.notification_id = notificationId;
    } else {
      await cancelPrayerNotification(p.notification_id);
      update.schedule_date = null;
      update.schedule_time = null;
      update.next_fire = null;
      update.notification_id = null;
      update.recurrence = 'none';
    }
  }

  await supabase.from('prayers').update(update).eq('id', prayerId);
}
