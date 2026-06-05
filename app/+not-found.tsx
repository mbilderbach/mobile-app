import { useMemo } from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, type ThemeColors } from '@/lib/theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function NotFoundScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Go to home screen!</Text>
      </Link>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    padding: 24,
  },
  title: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.ink },
  link: { marginTop: 16 },
  linkText: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.primary },
});
