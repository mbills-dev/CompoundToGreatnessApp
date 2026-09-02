import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity } from '@/types/database';
import { IdentityBuilder, IdentityBuilderResult } from '@/components/identity';
import DailyDashboard from '@/components/DailyDashboard';
import PaywallGate from '@/components/PaywallGate';
import LockedDashboardPreview from '@/components/LockedDashboardPreview';
import StartDateScreen from '@/components/StartDateScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoalBundle } from '@/hooks/useGoalBundle';
import { parseLocalDate, getTodayDateString } from '@/lib/dateHelpers';
import PreStartScreen from '@/components/PreStartScreen';
import BrandedLoadingScreen from '@/components/BrandedLoadingScreen';
import SaveProgressScreen from '@/components/SaveProgressScreen';
import { resyncAllReminders } from '@/lib/notifications';
import { awardSignedBadge } from '@/lib/badgeHelpers';
import { useBadgeCelebration } from '@/contexts/BadgeCelebrationContext';
import { logBreadcrumb } from '@/lib/crashBreadcrumbs';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user, isSubscribed } = useAuth();
  const { celebrateBadge } = useBadgeCelebration();
  const { setVisible } = useTabBarVisibility();
  const pendingBadgeCelebrationsRef = useRef<string[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSaveProgress, setShowSaveProgress] = useState(false);
  const [paywallCelebrate, setPaywallCelebrate] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showRestartChooser, setShowRestartChooser] = useState(false);
  const router = useRouter();
  const { chooseStart } = useLocalSearchParams();

  const { goal, pendingGoal, activities, isLoading: loading, invalidate: loadGoal } = useGoalBundle(user?.id);

  const isPreStart = !!goal?.scheduled_start_date && goal.scheduled_start_date > getTodayDateString();

  useEffect(() => {
    setVisible(!!goal);
  }, [goal]);

  useEffect(() => {
    if (chooseStart === '1' && goal && goal.challenge_start_date === null) {
      setShowRestartChooser(true);
      router.setParams({ chooseStart: undefined });
    }
  }, [chooseStart, goal, router]);

  const deletePendingGoals = async () => {
    try {
      await logBreadcrumb('delete_pending_goals_start');
      const { data: stale } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', user!.id)
        .eq('is_active', false)
        .is('challenge_start_date', null);

      if (stale && stale.length > 0) {
        const ids = stale.map(g => g.id);
        await supabase.from('daily_activities').delete().in('goal_id', ids);
        await supabase.from('goals').delete().in('id', ids);
      }
      await logBreadcrumb('delete_pending_goals_done', { staleCount: stale?.length ?? 0 });
    } catch (e) {
      console.error('delete_pending_goals_failed', String(e).slice(0, 200));
      await logBreadcrumb('delete_pending_goals_error', { error: String(e).slice(0, 200) });
    }
  };

  const createGoalAndActivities = async (
    result: IdentityBuilderResult,
    activate: boolean,
  ): Promise<Goal | null> => {
    try {
      await logBreadcrumb('create_goal_start', { inputCount: result.inputs.length });
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const { data: newGoal, error: goalError } = await supabase
        .from('goals')
        .insert({
          title: result.identityStatement,
          goal_type: 'personal',
          target_value: 0,
          target_date: new Date(Date.now() + 77 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          calculation_params: {},
          is_active: activate,
          user_id: user!.id,
          challenge_start_date: activate ? startDate.toISOString() : null,
          current_challenge_day: 0,
          identity_statement: result.identityStatement,
          identity_dimensions: result.dimensions,
          compass_vision: result.compass.vision,
          compass_declaration: result.compass.declaration,
          compass_filter_question: result.compass.filterQuestion,
        })
        .select()
        .single();

      if (goalError) {
        await logBreadcrumb('create_goal_error', { error: String(goalError).slice(0, 200) });
        throw goalError;
      }

      const activitiesToInsert = result.inputs.map((task, index) => {
        const raw = result.rawInputs?.[index];
        return {
          goal_id: newGoal.id,
          activity_name: task,
          activity_type: 'custom',
          target_count: 1,
          order_position: index + 1,
          what: raw?.what ?? null,
          when_time: raw?.when_time ?? null,
          where_location: raw?.where_location ?? null,
          schedule: raw?.schedule ?? null,
        };
      });

      const { data: newActivities, error: activitiesError } = await supabase
        .from('daily_activities')
        .insert(activitiesToInsert)
        .select();

      if (activitiesError) {
        await logBreadcrumb('create_activities_error', { error: String(activitiesError).slice(0, 200) });
        throw activitiesError;
      }

      await logBreadcrumb('create_goal_done', { goalId: newGoal.id });
      return newGoal;
    } catch (error) {
      console.error('Error creating goal:', error);
      return null;
    }
  };

  const handleIdentityComplete = async (result: IdentityBuilderResult): Promise<boolean> => {
    await logBreadcrumb('handle_identity_complete_start');
    await deletePendingGoals();
    const created = await createGoalAndActivities(result, false);
    if (!created) {
      await logBreadcrumb('handle_identity_complete_failed');
      return false;
    }
    await logBreadcrumb('handle_identity_complete_success');
    awardSignedBadge(user!.id).then((keys) => { pendingBadgeCelebrationsRef.current = keys; }).catch(() => {});
    resyncAllReminders(user!.id).catch(err => console.error('resyncAllReminders failed:', err));

    if (isSubscribed) {
      loadGoal();
      setShowStartDate(true);
    } else if (user?.is_anonymous) {
      loadGoal();
      setShowSaveProgress(true);
    } else {
      loadGoal();
      setPaywallCelebrate(true);
      setShowPaywall(true);
    }
    return true;
  };

  const activatePendingGoal = async (dateString: string) => {
    if (!pendingGoal) return;
    try {
      const startDate = parseLocalDate(dateString);

      const { data: activated, error } = await supabase
        .from('goals')
        .update({
          is_active: true,
          challenge_start_date: startDate.toISOString(),
          current_challenge_day: 0,
          scheduled_start_date: dateString,
        })
        .eq('id', pendingGoal.id)
        .select()
        .single();

      if (error) throw error;

      resyncAllReminders(user!.id).catch(err => console.error('resyncAllReminders failed:', err));
      await loadGoal();
      setShowPaywall(false);
      setPaywallCelebrate(false);
      if (pendingBadgeCelebrationsRef.current.length > 0) {
        const keys = pendingBadgeCelebrationsRef.current;
        pendingBadgeCelebrationsRef.current = [];
        setTimeout(() => {
          keys.forEach((key) => celebrateBadge(key));
        }, 500);
      }
    } catch (error) {
      console.error('Error activating goal:', error);
    }
  };

  const updateStartDate = async (dateString: string) => {
    if (!goal) return;
    try {
      const startDate = parseLocalDate(dateString);
      const { error } = await supabase
        .from('goals')
        .update({
          challenge_start_date: startDate.toISOString(),
          scheduled_start_date: dateString,
        })
        .eq('id', goal.id);
      if (error) throw error;
      resyncAllReminders(user!.id).catch(err => console.error('resyncAllReminders failed:', err));
      await loadGoal();
    } catch (error) {
      console.error('Error updating start date:', error);
    }
  };

  const onStartNow = () => updateStartDate(getTodayDateString());

  if (loading) {
    return <BrandedLoadingScreen />;
  }

  if (showSaveProgress) {
    return (
      <SaveProgressScreen
        onComplete={() => {
          setShowSaveProgress(false);
          setShowPaywall(true);
        }}
      />
    );
  }

  if (showPaywall) {
    return (
      <PaywallGate
        onDismiss={() => { setShowPaywall(false); setPaywallCelebrate(false); }}
        onSubscribeSuccess={() => { setShowPaywall(false); setShowStartDate(true); }}
        celebrate={paywallCelebrate}
      />
    );
  }

  if (showStartDate) {
    return (
      <StartDateScreen
        onSelect={async (dateString) => {
          await activatePendingGoal(dateString);
          setShowStartDate(false);
        }}
      />
    );
  }

  if (rescheduling) {
    return (
      <StartDateScreen
        onSelect={async (dateString) => {
          await updateStartDate(dateString);
          setRescheduling(false);
        }}
      />
    );
  }

  if (showRestartChooser && goal) {
    return (
      <StartDateScreen
        onSelect={async (dateString) => {
          await updateStartDate(dateString);
          setShowRestartChooser(false);
        }}
      />
    );
  }

  if (goal && isPreStart) {
    return (
      <PreStartScreen
        goal={goal}
        activities={activities}
        onStartNow={onStartNow}
        onChangeDate={() => setRescheduling(true)}
        onActivitiesChanged={loadGoal}
      />
    );
  }

  if (goal) {
    return (
      <DailyDashboard
        goal={goal}
        activities={activities}
        onRefresh={loadGoal}
      />
    );
  }

  if (pendingGoal) {
    return (
      <LockedDashboardPreview
        goal={pendingGoal}
        activities={activities}
        onUnlock={() => setShowPaywall(true)}
      />
    );
  }

  return <IdentityBuilder onComplete={handleIdentityComplete} />;
}


