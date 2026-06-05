/**
 * Theme provider — resolves the active palette from the user's appearance
 * preference (Auto / Light / Dark) and the OS colour scheme.
 *
 *  - `useTheme()` returns the active `ThemeColors` (use in components for both
 *    `makeStyles(colors)` and inline values like icon colours).
 *  - `useThemeControls()` exposes the chosen mode, the resolved scheme, and a
 *    setter — used by the Settings appearance control.
 *
 * Screens build styles with a `makeStyles(colors)` factory + `useMemo` so they
 * restyle when the palette changes. See lib/theme.ts.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type ThemeColors } from '@/lib/theme';
import { usePreferences, type ThemeMode } from '@/lib/preferences';

type Scheme = 'light' | 'dark';

interface ThemeControls {
  mode: ThemeMode;
  scheme: Scheme;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeColors>(lightColors);
const ThemeControlsContext = createContext<ThemeControls>({
  mode: 'auto',
  scheme: 'light',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { preferences, setPreference } = usePreferences();
  const mode = preferences.themeMode;

  const scheme: Scheme = mode === 'auto' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const controls = useMemo<ThemeControls>(
    () => ({ mode, scheme, setMode: (m) => setPreference('themeMode', m) }),
    [mode, scheme, setPreference]
  );

  return (
    <ThemeControlsContext.Provider value={controls}>
      <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>
    </ThemeControlsContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useThemeControls = () => useContext(ThemeControlsContext);
