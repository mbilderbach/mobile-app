import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Kicker, PrimaryButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { joinCircleByCode } from '@/lib/circles';
import { errorMessage } from '@/lib/writeSafety';

/** Join a circle by its invite code. No discovery — a code is the only way in. */
export default function CircleJoinScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useToast();

  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = code.trim().length < 4 || !displayName.trim() || busy;

  const submit = async () => {
    if (disabled || !user) return;
    setBusy(true);
    try {
      await joinCircleByCode(code, displayName);
      router.replace('/(tabs)/together');
    } catch (error) {
      showError(errorMessage(error, 'That code didn’t match a circle. Check it and try again.'));
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>Join a circle</Text>
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <View style={styles.field}>
            <Kicker>Invite code</Kicker>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ABC123"
              placeholderTextColor={colors.quiet}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              autoFocus
              autoCapitalize="characters"
              maxLength={6}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Kicker>Your name here</Kicker>
            <TextInput
              style={styles.input}
              placeholder="How others see you"
              placeholderTextColor={colors.quiet}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>

          <Text style={styles.note}>
            Ask the circle’s creator for the 6-character code. There’s no way to find a circle
            without it — that’s what keeps it private.
          </Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label="Join circle" onPress={submit} disabled={disabled} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? 18 : 56,
    paddingBottom: 12,
  },
  cancel: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.muted },
  navTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 22 },
  field: { gap: 8 },
  input: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeInput: { fontSize: 22, letterSpacing: 6, fontFamily: fonts.sansBold, textAlign: 'center' },
  note: { fontFamily: fonts.sans, fontSize: 13, color: colors.quiet, lineHeight: 19 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: Platform.OS === 'web' ? 24 : 40, paddingTop: 8 },
});
