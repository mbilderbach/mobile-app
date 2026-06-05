/**
 * App-wide toast / undo bar.
 *
 * A single floating pill at the bottom of the screen used for two things:
 *  - surfacing a write failure that we used to swallow (`showError`)
 *  - offering an Undo after a reversible action like soft-deleting a prayer
 *    (`showUndo`)
 *
 * Mounted once at the root (app/_layout.tsx) so any screen can call `useToast()`.
 * The pill uses a fixed elevated charcoal so it reads as a contrasting surface
 * in both light and dark themes.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, radius, shadow, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';

type Tone = 'neutral' | 'error';

interface ToastConfig {
  message: string;
  tone: Tone;
  actionLabel?: string;
  onAction?: () => void;
  /** ms before auto-dismiss. Undo bars linger a touch longer. */
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, opts?: { tone?: Tone; actionLabel?: string; onAction?: () => void; duration?: number }) => void;
  showError: (message: string) => void;
  showUndo: (message: string, onUndo: () => void) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showError: () => {},
  showUndo: () => {},
  dismiss: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => setToast(null));
  }, [anim, clearTimer]);

  const showToast = useCallback<ToastContextType['showToast']>((message, opts) => {
    clearTimer();
    const cfg: ToastConfig = {
      message,
      tone: opts?.tone ?? 'neutral',
      actionLabel: opts?.actionLabel,
      onAction: opts?.onAction,
      duration: opts?.duration ?? 3200,
    };
    setToast(cfg);
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    timerRef.current = setTimeout(hide, cfg.duration);
  }, [anim, clearTimer, hide]);

  const showError = useCallback((message: string) => {
    showToast(message, { tone: 'error', duration: 4200 });
  }, [showToast]);

  const showUndo = useCallback((message: string, onUndo: () => void) => {
    showToast(message, { actionLabel: 'Undo', onAction: onUndo, duration: 5000 });
  }, [showToast]);

  useEffect(() => clearTimer, [clearTimer]);

  const onActionPress = useCallback(() => {
    const action = toast?.onAction;
    hide();
    action?.();
  }, [toast, hide]);

  return (
    <ToastContext.Provider value={{ showToast, showError, showUndo, dismiss: hide }}>
      {children}
      {toast ? (
        <View style={styles.host} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.pill,
              toast.tone === 'error' && styles.pillError,
              {
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
            {toast.actionLabel ? (
              <Pressable
                onPress={onActionPress}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// Fixed elevated charcoal so the toast reads as a contrasting surface in BOTH
// themes (a near-black pill sits above dark charcoal and above white alike).
const TOAST_BG = '#2B2A31';

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'web' ? 24 : 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    maxWidth: 460,
    width: '100%',
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: TOAST_BG,
    ...shadow.float,
    shadowColor: '#23222E',
  },
  pillError: { backgroundColor: colors.error },
  message: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: '#FFFFFF', letterSpacing: -0.1 },
  action: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  actionPressed: { opacity: 0.6 },
  actionText: { fontFamily: fonts.sansBold, fontSize: 14, color: '#FFFFFF', letterSpacing: -0.1 },
});
