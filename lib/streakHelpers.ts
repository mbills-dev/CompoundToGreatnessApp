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

export async function computeStreaksForGoals(
  goalIds: string[]
): Promise<Map<string, number>> {
  if (goalIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('daily_completions')
    .select('goal_id, completion_date')
    .in('goal_id', goalIds)
    .not('completed_at', 'is', null)
    .order('completion_date', { ascending: false })
    .limit(1000 * goalIds.length);

  if (error) throw error;

  const byGoal = new Map<string, string[]>();
  (data || []).forEach((row) => {
    const list = byGoal.get(row.goal_id) || [];
    list.push(row.completion_date);
    byGoal.set(row.goal_id, list);
  });

  const result = new Map<string, number>();
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(currentDate);

  for (const goalId of goalIds) {
    const sortedDates = (byGoal.get(goalId) || []).sort().reverse();
    let streakCount = 0;
    const cursor = new Date(currentDate);
    if (!sortedDates.includes(todayStr)) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (const dateString of sortedDates) {
      const date = parseLocalDate(dateString);
      const expectedDate = new Date(cursor);
      expectedDate.setDate(expectedDate.getDate() - streakCount);
      if (toLocalDateString(date) === toLocalDateString(expectedDate)) {
        streakCount++;
      } else {
        break;
      }
    }
    result.set(goalId, streakCount);
  }

  return result;
}
