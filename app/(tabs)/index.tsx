import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity } from '@/types/database';
import { IdentityBuilder, IdentityBuilderResult } from '@/components/identity';
import DailyDashboard from '@/components/DailyDashboard';
import PaywallGate from '@/components/PaywallGate';
import LockedDashboardPreview from '@/components/LockedDashboardPreview';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user, isSubscribed } = useAuth();
  const { setVisible } = useTabBarVisibility();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallCelebrate, setPaywallCelebrate] = useState(false);

  useEffect(() => {
    if (user) {
      loadGoal();
    }
  }, [user]);

  useEffect(() => {
    setVisible(!!goal);
  }, [goal]);

  const loadGoal = async () => {
    try {
      // 1. Try active goal first.
      const { data: activeGoal, error: activeError } = await supabase
        .from('goals')
        .select('*')
        .eq('is_active', true)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (activeError) throw activeError;

      if (activeGoal) {
        setGoal(activeGoal);
        setPendingGoal(null);
        await loadActivities(activeGoal.id);
        return;
      }

      // 2. No active goal — look for a pending (unsubscribed) goal.
      const { data: pending, error: pendingError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', false)
        .is('challenge_start_date', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingError) throw pendingError;

      if (pending) {
        setPendingGoal(pending);
        await loadActivities(pending.id);
      }
    } catch (error) {
      console.error('Error loading goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (goalId: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_activities')
        .select('*')
        .eq('goal_id', goalId)
        .order('order_position');

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const deletePendingGoals = async () => {
    // Remove any previously-saved pending goals (is_active=false, start=null)
    // before inserting a fresh one. Never touches archived/active rows.
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
  };

  const createGoalAndActivities = async (
    result: IdentityBuilderResult,
    activate: boolean,
  ): Promise<Goal | null> => {
    try {
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

      if (goalError) throw goalError;

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

      if (activitiesError) throw activitiesError;

      setActivities(newActivities || []);
      return newGoal;
    } catch (error) {
      console.error('Error creating goal:', error);
      return null;
    }
  };

  const handleIdentityComplete = async (result: IdentityBuilderResult) => {
    await deletePendingGoals();
    const created = await createGoalAndActivities(result, isSubscribed);
    if (!created) return;

    if (isSubscribed) {
      setGoal(created);
    } else {
      setPendingGoal(created);
      setPaywallCelebrate(true);
      setShowPaywall(true);
    }
  };

  const activatePendingGoal = async () => {
    if (!pendingGoal) return;
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      const { data: activated, error } = await supabase
        .from('goals')
        .update({
          is_active: true,
          challenge_start_date: startDate.toISOString(),
          current_challenge_day: 0,
        })
        .eq('id', pendingGoal.id)
        .select()
        .single();

      if (error) throw error;

      setGoal(activated);
      setPendingGoal(null);
      setShowPaywall(false);
      setPaywallCelebrate(false);
    } catch (error) {
      console.error('Error activating goal:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showPaywall) {
    return (
      <PaywallGate
        onDismiss={() => { setShowPaywall(false); setPaywallCelebrate(false); }}
        onSubscribeSuccess={activatePendingGoal}
        celebrate={paywallCelebrate}
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
