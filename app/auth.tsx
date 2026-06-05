import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { ScreenTitle, Card, Kicker, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/writeSafety';

export default function AuthScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { signIn, signUp } = useAuth();

  // Apple sign-in is iOS-only and requires the native capability; hide it elsewhere.
  useEffect(() => {
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => { if (active) setAppleAvailable(available); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);

    const { error: authError } = isSignUp
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password);

    if (authError) {
      setError(authError.message);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then tap “Forgot password.”');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) setError(resetError.message);
    else setNotice('Check your email for a link to reset your password.');
  };

  const handleAppleSignIn = async () => {
    setError(null);
    setNotice(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setError('Apple did not return a sign-in token. Please try again.');
        return;
      }
      const { error: appleError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (appleError) setError(appleError.message);
    } catch (e: any) {
      // The user cancelling the native sheet is not an error worth surfacing.
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      setError(errorMessage(e, 'Could not sign in with Apple. Please try again.'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <ScreenTitle
          title={isSignUp ? 'Create account' : 'Welcome back'}
          subtitle="A quiet place for prayer"
          size="page"
          style={styles.header}
        />

        <Card style={styles.card}>
          <View style={styles.inputGroup}>
            <Kicker>Email</Kicker>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.quiet}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Kicker>Password</Kicker>
            <TextInput
              style={styles.input}
              placeholder={isSignUp ? 'Choose a password' : 'Enter your password'}
              placeholderTextColor={colors.quiet}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {notice && (
            <View style={styles.noticeRow}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          <PrimaryButton
            label={isSignUp ? 'Create account' : 'Sign in'}
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.button}
          />

          {!isSignUp && (
            <Pressable onPress={handleForgotPassword} disabled={loading} hitSlop={8} style={styles.forgotButton} accessibilityRole="button">
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}
        </Card>

        {appleAvailable && (
          <View style={styles.appleWrap}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={28}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          </View>
        )}

        <Pressable
          style={styles.switchButton}
          onPress={() => { setIsSignUp(!isSignUp); setError(null); setNotice(null); }}
        >
          <Text style={styles.switchText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.switchTextBold}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  card: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  input: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorRow: {
    backgroundColor: 'rgba(229,65,58,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.error,
  },
  noticeRow: {
    backgroundColor: colors.selectedBg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.selectedText,
    lineHeight: 18,
  },
  button: {
    marginTop: 4,
  },
  forgotButton: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.muted,
    letterSpacing: -0.1,
  },
  appleWrap: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
  dividerText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.quiet,
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
  switchButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
  },
  switchTextBold: {
    fontFamily: fonts.sansBold,
    color: colors.ink,
  },
});
