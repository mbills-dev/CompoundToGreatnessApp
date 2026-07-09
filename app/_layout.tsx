import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_900Black } from '@expo-google-fonts/inter';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermissions, scheduleDailyReminders } from '@/lib/notifications';
import AuthScreen from '@/components/AuthScreen';
import SignupSplashScreen from '@/components/SignupSplashScreen';
import WatcherHomeScreen from '@/components/WatcherHomeScreen';

function isWatchInviteUrl(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/watch/');
  }
  return false;
}

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isDark, colors } = useTheme();
  const { session, loading, onboardingCompleted, completeOnboarding, isNewSignup, clearNewSignup, isWatcher, watchedUserId, user, signOut } = useAuth();

  useEffect(() => {
    if (session) {
      const initNotifications = async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await scheduleDailyReminders();
        }
      };
      initNotifications();
    }
  }, [session]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const onWatchRoute = isWatchInviteUrl();

  if (!session && !onWatchRoute) {
    return (
      <>
        <AuthScreen />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    );
  }

  if (session && isWatcher && watchedUserId && user && !onWatchRoute) {
    return (
      <>
        <WatcherHomeScreen
          watcherId={user.id}
          watchedId={watchedUserId}
          onSignOut={signOut}
          onStartOwn={async () => { await signOut(); }}
        />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    );
  }

  if (session && (isNewSignup || !onboardingCompleted) && !onWatchRoute) {
    return (
      <>
        <SignupSplashScreen onComplete={isNewSignup ? clearNewSignup : completeOnboarding} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="watch/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="archived-challenges" options={{ headerShown: false }} />
        <Stack.Screen name="archived-challenge-detail" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Black': Inter_900Black,
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
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
