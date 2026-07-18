import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity } from '@/types/database';

export interface GoalBundle {
  goal: Goal | null;
  pendingGoal: Goal | null;
  activities: DailyActivity[];
}

export async function fetchGoalBundle(userId: string): Promise<GoalBundle> {
  const { data: activeGoal, error: activeError } = await supabase
    .from('goals')
    .select('*')
    .eq('is_active', true)
    .eq('user_id', userId)
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
      .eq('user_id', userId)
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
}

export function useGoalBundle(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['goal-bundle', userId],
    queryFn: () => fetchGoalBundle(userId!),
    enabled: !!userId,
  });

  const invalidate = () => {
    return queryClient.invalidateQueries({ queryKey: ['goal-bundle', userId] });
  };

  return {
    goal: query.data?.goal ?? null,
    pendingGoal: query.data?.pendingGoal ?? null,
    activities: query.data?.activities ?? [],
    isLoading: query.isLoading,
    invalidate,
  };
}
