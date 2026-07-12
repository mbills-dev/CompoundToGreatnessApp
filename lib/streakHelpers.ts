import { supabase } from '@/lib/supabase';
import { toLocalDateString, parseLocalDate } from '@/lib/dateHelpers';

export async function computeCurrentStreak(goalId: string): Promise<number> {
  const { data, error } = await supabase
    .from('daily_completions')
    .select('completion_date')
    .eq('goal_id', goalId)
    .not('completed_at', 'is', null)
    .order('completion_date', { ascending: false })
    .limit(1000);

  if (error) throw error;

  let streakCount = 0;
  const sortedDates = (data || []).map((d) => d.completion_date).sort().reverse();
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const todayStr = toLocalDateString(currentDate);
  if (!sortedDates.includes(todayStr)) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  for (const dateString of sortedDates) {
    const date = parseLocalDate(dateString);
    const expectedDate = new Date(currentDate);
    expectedDate.setDate(expectedDate.getDate() - streakCount);

    if (toLocalDateString(date) === toLocalDateString(expectedDate)) {
      streakCount++;
    } else {
      break;
    }
  }

  return streakCount;
}
