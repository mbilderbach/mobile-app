import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme, useThemeControls } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import { loadPreferences } from '@/lib/preferences';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading, onboarded } = useAuth();
  const colors = useTheme();
  const { scheme } = useThemeControls();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inPreview = segments[0] === 'nova-preview'; // dev-only, no auth required

    if (inPreview) return;

    if (!user) {
      if (!inAuthGroup) router.replace('/auth');
      return;
    }

    // Signed in — wait until the onboarding flag has resolved before routing.
    if (onboarded === null) return;

    if (!onboarded) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [user, loading, onboarded, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="add-prayer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="session" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="pray-along" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="prayer/[id]" />
        <Stack.Screen name="edit-prayer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="explore-category" />
        <Stack.Screen name="explore-prayer" />
        <Stack.Screen name="circle-create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="circle-join" options={{ presentation: 'modal' }} />
        <Stack.Screen name="circle-share" options={{ presentation: 'modal' }} />
        <Stack.Screen name="circle-request" />
        <Stack.Screen name="circle-settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="nova-preview" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    loadPreferences();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'PlayfairDisplay-Regular': PlayfairDisplay_400Regular,
    'PlayfairDisplay-Italic': PlayfairDisplay_400Regular_Italic,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
