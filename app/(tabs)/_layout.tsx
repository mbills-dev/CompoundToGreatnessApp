import { View, Platform } from 'react-native';
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFriends, friendsKey } from '@/hooks/useFriends';
import { fetchSettingsBundle, settingsBundleKey } from '@/hooks/useSettingsBundle';
import { fetchGoalBundle } from '@/hooks/useGoalBundle';
import { fetchCompletions, completionsKey } from '@/hooks/useCompletions';
import { RacingBorderProvider, useRacingBorder } from '@/contexts/RacingBorderContext';
import { CelebrationProvider } from '@/contexts/CelebrationContext';
import { TabBarVisibilityProvider, useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { RacingBorder } from '@/components/RacingBorder';
import Svg, { Path } from 'react-native-svg';

function HomeIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <Path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </Svg>
  );
}

function ProgressIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
    </Svg>
  );
}

function SettingsIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M18.75 12.75h1.5a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5ZM12 6a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 12 6ZM12 18a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 12 18ZM3.75 6.75h1.5a.75.75 0 1 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5ZM5.25 18.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 0 1.5ZM3 12a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 3 12ZM9 3.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM12.75 12a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM9 15.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
    </Svg>
  );
}

function TabLayoutInner() {
  const { colors, isDark } = useTheme();
  const { showRacingBorder, resetRacingBorder } = useRacingBorder();
  const { visible } = useTabBarVisibility();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    queryClient.prefetchQuery({
      queryKey: friendsKey(user.id),
      queryFn: () => fetchFriends(user.id),
    });
    queryClient.prefetchQuery({
      queryKey: settingsBundleKey(user.id),
      queryFn: () => fetchSettingsBundle(user),
    });
    (async () => {
      try {
        const bundle = await queryClient.fetchQuery({
          queryKey: ['goal-bundle', user.id],
          queryFn: () => fetchGoalBundle(user.id),
        });
        const goalId = bundle.goal?.id ?? bundle.pendingGoal?.id;
        if (goalId) {
          queryClient.prefetchQuery({
            queryKey: completionsKey(goalId),
            queryFn: () => fetchCompletions(goalId),
          });
        }
      } catch {
        // prefetch is best-effort; screens fetch on demand if this fails
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const bg = isDark ? colors.background : '#F5F5F0';
      document.documentElement.style.backgroundColor = bg;
      document.body.style.backgroundColor = bg;
    }
  }, [isDark, colors.background]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            maxWidth: 480,
            width: '100%',
            alignSelf: 'center',
            backgroundColor: isDark ? colors.background : '#F5F5F0',
          },
          tabBarStyle: {
            backgroundColor: isDark ? colors.background : '#F5F5F0',
            borderTopWidth: 0,
            height: 90,
            paddingBottom: 30,
            paddingTop: 10,
            display: visible ? 'flex' : 'none',
            maxWidth: 480,
            width: '100%',
            alignSelf: 'center',
          },
          tabBarActiveTintColor: '#CCFF00',
          tabBarInactiveTintColor: isDark ? colors.textTertiary : 'rgba(0,0,0,0.3)',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarItemStyle: {
            backgroundColor: 'transparent',
          },
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveBackgroundColor: 'transparent',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ size, color }) => (
              <HomeIcon size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Progress',
            tabBarIcon: ({ size, color }) => (
              <ProgressIcon size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            tabBarIcon: ({ size, color }) => (
              <Users size={size} color={color} fill={color} strokeWidth={0} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ size, color }) => (
              <SettingsIcon size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <RacingBorder visible={showRacingBorder} onComplete={resetRacingBorder} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <TabBarVisibilityProvider>
      <CelebrationProvider>
        <RacingBorderProvider>
          <TabLayoutInner />
        </RacingBorderProvider>
      </CelebrationProvider>
    </TabBarVisibilityProvider>
  );
}
