import { supabase } from '@/lib/supabase';
import { DailyCompletion } from '@/types/database';

export const completionsKey = (goalId: string) => ['completions', goalId];

export async function fetchCompletions(goalId: string): Promise<DailyCompletion[]> {
  const { data, error } = await supabase
    .from('daily_completions')
    .select('*')
    .eq('goal_id', goalId)
    .order('completion_date', { ascending: true });
  if (error) throw error;
  return data || [];
}
