/**
 * Local UI preferences (haptics / sounds / reminders).
 *
 * Persisted in AsyncStorage and mirrored in a module-level cache so non-React
 * code — notably lib/haptics.ts, which fires inside event handlers — can read
 * the current value synchronously without a hook. React screens use the
 * `usePreferences` hook, which subscribes to changes.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Preferences {
  haptics: boolean;
  sounds: boolean;
  reminders: boolean;
  /** App appearance: follow the OS ('auto') or force light/dark. */
  themeMode: ThemeMode;
}

export const DEFAULT_PREFERENCES: Preferences = {
  haptics: true,
  sounds: false,
  reminders: true,
  themeMode: 'auto',
};

const STORAGE_KEY = 'preferences';

let cache: Preferences = { ...DEFAULT_PREFERENCES };
let loaded = false;
const listeners = new Set<(p: Preferences) => void>();

/** Synchronous read of the last-known preferences (cached). */
export function getPreferences(): Preferences {
  return cache;
}

/** Load persisted preferences into the cache. Call once at app start. */
export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) cache = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    // Corrupt/missing storage → fall back to defaults already in the cache.
  }
  loaded = true;
  listeners.forEach((l) => l(cache));
  return cache;
}

export async function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> {
  cache = { ...cache, [key]: value };
  listeners.forEach((l) => l(cache));
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Best-effort persistence; the in-memory cache stays correct for this session.
  }
}

function subscribe(listener: (p: Preferences) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Reactive accessor for screens: current preferences + a setter. */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(cache);

  useEffect(() => {
    let active = true;
    if (!loaded) loadPreferences().then((p) => { if (active) setPreferences(p); });
    const unsub = subscribe(setPreferences);
    return () => { active = false; unsub(); };
  }, []);

  return { preferences, setPreference };
}
