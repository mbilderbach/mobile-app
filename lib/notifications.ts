import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { buildNextFire } from './schedule';
import { getPreferences } from './preferences';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function cancelPrayerNotification(notificationId?: string | null) {
  if (!notificationId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // If the OS already dropped it, there is nothing useful to recover.
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prayer-reminders', {
      name: 'Prayer reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: undefined,
      vibrationPattern: [0, 180, 120, 180],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: false, allowBadge: false },
  });

  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function schedulePrayerNotification(input: {
  title: string;
  scheduleDate?: string | null;
  scheduleTime?: string | null;
}): Promise<string | null> {
  if (Platform.OS === 'web' || !input.scheduleDate) return null;
  // Respect the user's Reminders preference — off means no local notifications.
  if (!getPreferences().reminders) return null;

  const nextFire = buildNextFire(input.scheduleDate, input.scheduleTime);
  if (!nextFire) return null;

  const date = new Date(nextFire);
  if (date.getTime() <= Date.now()) return null;

  const allowed = await ensureNotificationPermission();
  if (!allowed) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to pray',
      body: input.title,
      sound: false,
      data: { type: 'prayer-reminder' },
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date, channelId: 'prayer-reminders' },
  });
}

export async function reschedulePrayerNotification(input: {
  previousId?: string | null;
  title: string;
  scheduleDate?: string | null;
  scheduleTime?: string | null;
}): Promise<string | null> {
  await cancelPrayerNotification(input.previousId);
  return schedulePrayerNotification(input);
}
