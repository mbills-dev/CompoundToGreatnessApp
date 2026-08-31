import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_900Black, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { getBreadcrumbs, clearBreadcrumbs } from '@/lib/crashBreadcrumbs';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermissions, resyncAllReminders } from '@/lib/notifications';
import { registerPushToken } from '@/lib/pushTokens';
import AuthScreen from '@/components/AuthScreen';
import { useGoalBundle } from '@/hooks/useGoalBundle';
import SignupSplashScreen from '@/components/SignupSplashScreen';
import UsernamePicker from '@/components/UsernamePicker';
import WatcherHomeScreen from '@/components/WatcherHomeScreen';
import BrandedLoadingScreen from '@/components/BrandedLoadingScreen';
import { BadgeCelebrationProvider } from '@/contexts/BadgeCelebrationContext';

function isWatchInviteUrl(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/watch/');
  }
  return false;
}

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'ios') {
  Purchases.configure({ apiKey: 'appl_tmLwtbeJFSUTbMOjWxQWtDxJyNN' });
}

function AppContent() {
  const { isDark, colors } = useTheme();
  const { session, loading, isNewSignup, clearNewSignup, isWatcher, watchedUserId, user, signOut, needsUsername, clearNeedsUsername } = useAuth();
  const { isLoading: goalLoading } = useGoalBundle(session?.user?.id);
  const splashMountTime = useRef(Date.now());

  useEffect(() => {
    if (session) {
      const initNotifications = async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
          await resyncAllReminders(session.user.id);
          registerPushToken(session.user.id).catch(() => {});
        }
      };
      initNotifications();
    }
  }, [session]);

  useEffect(() => {
    const appReady = !loading && (!session || !goalLoading);
    if (!appReady) return;
    const elapsed = Date.now() - splashMountTime.current;
    const remaining = Math.max(0, 700 - elapsed);
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, remaining);
    return () => clearTimeout(timer);
  }, [loading, session, goalLoading]);

  if (loading) {
    return <BrandedLoadingScreen />;
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

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'C2G_QUERY_CACHE',
});

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Black': Inter_900Black,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    getBreadcrumbs().then(crumbs => {
      if (crumbs.length > 0) {
        const summary = crumbs.map(c => `${c.step}${c.meta ? ' ' + JSON.stringify(c.meta) : ''}`).join('\n');
        Alert.alert('Last Session Breadcrumbs', summary, [
          { text: 'Clear & Dismiss', onPress: () => clearBreadcrumbs() },
          { text: 'Keep for now', style: 'cancel' },
        ]);
      }
    });
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // NOTE: All current queries (friends, badges, goal bundles) are safe to persist to disk.
  // If a future query returns sensitive data (e.g. payment details), exclude it via
  // persistOptions.dehydrateOptions.shouldDehydrateQuery before it lands in AsyncStorage.
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24,
        buster: 'v1',
      }}
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <AuthProvider>
            <BadgeCelebrationProvider>
              <AppContent />
            </BadgeCelebrationProvider>
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}


