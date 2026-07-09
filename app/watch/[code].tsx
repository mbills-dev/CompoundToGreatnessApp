import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import WatcherSignupScreen from '@/components/WatcherSignupScreen';
import PublicJourneyPage from '@/components/PublicJourneyPage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type RouteType = 'loading' | 'public' | 'invite';

export default function WatchPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { signOut } = useAuth();
  const [routeType, setRouteType] = useState<RouteType>('loading');
  const [resolvedUsername, setResolvedUsername] = useState('');

  useEffect(() => {
    if (!code) return;
    resolveRoute(code);
  }, [code]);

  const resolveRoute = async (slug: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', slug)
      .maybeSingle();

    if (profile) {
      setResolvedUsername(slug);
      setRouteType('public');
      return;
    }

    setRouteType('invite');
  };

  const handleWatcherReady = useCallback(async () => {
    router.replace('/');
  }, [router]);

  const handleStartOwn = useCallback(async () => {
    await signOut();
    router.replace('/');
  }, [signOut, router]);

  if (routeType === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ccff00" />
      </View>
    );
  }

  if (routeType === 'public') {
    return <PublicJourneyPage username={resolvedUsername} />;
  }

  return (
    <View style={styles.container}>
      <WatcherSignupScreen
        inviteCode={code ?? ''}
        onWatcherReady={handleWatcherReady}
        onStartOwn={handleStartOwn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
});
