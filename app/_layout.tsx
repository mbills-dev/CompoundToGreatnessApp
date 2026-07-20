import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_900Black, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermissions, resyncAllReminders } from '@/lib/notifications';
import AuthScreen from '@/components/AuthScreen';
import SignupSplashScreen from '@/components/SignupSplashScreen';
import UsernamePicker from '@/components/UsernamePicker';
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
  const { session, loading, isNewSignup, clearNewSignup, isWatcher, watchedUserId, user, signOut, needsUsername, clearNeedsUsername } = useAuth();

  useEffect(() => {
    if (session) {
      const initNotifications = async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await resyncAllReminders(session.user.id);
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

  if (session && isNewSignup && !onWatchRoute) {
    return (
      <>
        <SignupSplashScreen onComplete={clearNewSignup} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    );
  }

  if (session && !isWatcher && needsUsername && !onWatchRoute) {
    return (
      <>
        <UsernamePicker onComplete={clearNeedsUsername} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isDark ? colors.background : '#F5F5F0' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="watch/[code]" options={{ headerShown: false }} />
        <Stack.Screen name="archived-challenges" options={{ headerShown: false }} />
        <Stack.Screen name="archived-challenge-detail" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 30,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Black': Inter_900Black,
    'Inter-Bold': Inter_700Bold,
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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
