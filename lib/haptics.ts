/**
 * Thin wrapper around expo-haptics that respects the user's "Haptic feedback"
 * preference and no-ops on web. Reserve `success` for the emotional payoffs
 * (finishing a session, an Amen, marking a prayer answered); `selection` is the
 * light tick for toggles and small confirmations.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getPreferences } from './preferences';

function enabled(): boolean {
  return Platform.OS !== 'web' && getPreferences().haptics;
}

export function hapticSuccess(): void {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticSelection(): void {
  if (enabled()) Haptics.selectionAsync().catch(() => {});
}

export function hapticImpact(): void {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
