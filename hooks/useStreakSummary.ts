import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { computeCurrentStreak } from '@/lib/streakHelpers';

export const streakSummaryKey = (goalId: string) => ['streak-summary', goalId];

export function useStreakSummary(goalId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: streakSummaryKey(goalId),
    queryFn: async () => {
      const streakCount = await computeCurrentStreak(goalId);

      const { count: perfectCount, error: perfectError } = await supabase
        .from('daily_completions')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', goalId)
        .not('completed_at', 'is', null);
      if (perfectError) throw perfectError;

      const now = new Date();
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { count: monthCount, error: monthError } = await supabase
        .from('daily_completions')
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', goalId)
        .like('completion_date', `${monthPrefix}%`)
        .not('completed_at', 'is', null);
      if (monthError) throw monthError;

      return {
        streak: streakCount,
        perfectDays: perfectCount || 0,
        phase2ThisMonth: monthCount || 0,
      };
    },
  });

  const invalidate = () => {
    return queryClient.invalidateQueries({ queryKey: streakSummaryKey(goalId) });
  };

  return {
    streak: query.data?.streak ?? 0,
    perfectDays: query.data?.perfectDays ?? 0,
    phase2ThisMonth: query.data?.phase2ThisMonth ?? 0,
    invalidate,
  };
}
