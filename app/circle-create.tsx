import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Kicker, PrimaryButton } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { createCircle } from '@/lib/circles';
import { errorMessage } from '@/lib/writeSafety';

/** Create a private circle. The display name is how co-members will see you here. */
export default function CircleCreateScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useToast();

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const disabled = !name.trim() || !displayName.trim() || busy;

  const submit = async () => {
    if (disabled || !user) return;
    setBusy(true);
    try {
      const id = await createCircle(name, displayName);
      // Replace so Back returns to Together, now showing the new circle.
      router.replace('/(tabs)/together');
      void id;
    } catch (error) {
      showError(errorMessage(error, 'Could not create the circle. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>New circle</Text>
        <View style={{ width: 52 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <View style={styles.field}>
            <Kicker>Circle name</Kicker>
            <TextInput
              style={styles.input}
              placeholder="The Family, Tuesday Group…"
              placeholderTextColor={colors.quiet}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={40}
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
            Circles are private and invite-only. You’ll get a code to share once it’s created.
          </Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label="Create circle" onPress={submit} disabled={disabled} loading={busy} />
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
  note: { fontFamily: fonts.sans, fontSize: 13, color: colors.quiet, lineHeight: 19 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: Platform.OS === 'web' ? 24 : 40, paddingTop: 8 },
});
