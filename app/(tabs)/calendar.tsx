import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity } from '@/types/database';
import CalendarView from '@/components/CalendarView';
import MonthCalendarView from '@/components/MonthCalendarView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const fetchGoalBundle = async () => {
    const { data: activeGoal, error: activeError } = await supabase
      .from('goals')
      .select('*')
      .eq('is_active', true)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (activeError) throw activeError;

    let resolvedGoal: Goal | null = null;
    let resolvedPending: Goal | null = null;

    if (activeGoal) {
      resolvedGoal = activeGoal;
    } else {
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
      resolvedPending = pending ?? null;
    }

    const goalForActivities = resolvedGoal ?? resolvedPending;
    let resolvedActivities: DailyActivity[] = [];
    if (goalForActivities) {
      const { data, error } = await supabase
        .from('daily_activities')
        .select('*')
        .eq('goal_id', goalForActivities.id)
        .order('order_position');
      if (error) throw error;
      resolvedActivities = data ?? [];
    }

    return { goal: resolvedGoal, pendingGoal: resolvedPending, activities: resolvedActivities };
  };

  const { data: goalBundle, isLoading } = useQuery({
    queryKey: ['goal-bundle', user?.id],
    queryFn: fetchGoalBundle,
    enabled: !!user,
  });

  const goal = goalBundle?.goal ?? null;

  const refreshGoal = () => {
    return queryClient.invalidateQueries({ queryKey: ['goal-bundle', user?.id] });
  };

  if (isLoading || !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Set up your goal first to view your progress
        </Text>
      </View>
    );
  }

  if (goal.challenge_phase === 'keep_going') {
    return <MonthCalendarView goal={goal} onRefresh={refreshGoal} />;
  }

  return <CalendarView goal={goal} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
