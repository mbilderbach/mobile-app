import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { fonts, spacing, radius, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Kicker, ScreenTitle, PrimaryButton } from '@/components/ui';
import { errorMessage, throwIfError } from '@/lib/writeSafety';
import { useToast } from '@/components/Toast';

export default function OnboardingScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, completeOnboarding } = useAuth();
  const { showError } = useToast();

  const handleSaveForLater = async () => {
    if (!title.trim() || !user) return;
    setLoading(true);
    try {
      throwIfError(
        await supabase.from('prayers').insert({ user_id: user.id, title: title.trim(), is_library: true }),
        'Could not save this prayer. Your text is still here.'
      );
      await completeOnboarding();
      router.replace('/(tabs)');
    } catch (error) {
      showError(errorMessage(error, 'Could not save this prayer. Your text is still here.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const disabled = !title.trim() || loading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Subtle brand touch: a thin violet accent bar at the right edge */}
      <View style={styles.accentBar} pointerEvents="none" />

      <View style={styles.inner}>
        {/* Header — calm typographic hero */}
        <View style={styles.header}>
          <Kicker>Welcome</Kicker>
          <ScreenTitle
            title={"What's on your\nheart right now?"}
            subtitle="A prayer, a person, a hope."
            size="hero"
            style={styles.title}
          />
          <Text style={styles.context}>Add your first prayer.</Text>
        </View>

        {/* Input */}
        <TextInput
          style={styles.input}
          placeholder="A prayer, a person, a hope..."
          placeholderTextColor={colors.quiet}
          value={title}
          onChangeText={setTitle}
          autoFocus
          multiline={false}
        />

        {/* Onboarding only saves — praying happens later, from the app. The skip
            is always available so no one is forced to write something now. */}
        <View style={styles.actions}>
          <PrimaryButton label="Save for later" onPress={handleSaveForLater} disabled={disabled} loading={loading} />
        </View>

        <Pressable onPress={handleSkip} style={styles.skipButton} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip for now">
          <Text style={styles.skipText}>Skip for now</Text>
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
  accentBar: {
    position: 'absolute',
    right: 0,
    top: '38%',
    width: 3,
    height: 72,
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
    backgroundColor: colors.selectedBg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    marginTop: 14,
  },
  context: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    marginTop: 12,
  },
  input: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: 12,
  },
  skipButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.muted,
  },
});
