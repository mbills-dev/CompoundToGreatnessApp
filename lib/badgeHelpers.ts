import { supabase } from '@/lib/supabase';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import { Goal } from '@/types/database';

export async function checkAndAwardBadges(userId: string, goal: Goal): Promise<void> {
  const streak = await computeCurrentStreak(goal.id);

  const { count: lifetimeDays } = await supabase
    .from('daily_completions')
    .select('completion_date', { count: 'exact', head: true })
    .eq('goal_id', goal.id)
    .not('completed_at', 'is', null);

  const badgeKeys: string[] = [];

  if (goal.current_challenge_day === 77 && (goal.challenge_phase === 'challenge' || goal.challenge_phase === 'keep_going')) {
    badgeKeys.push('day_77_complete');
  }

  if (goal.challenge_phase === 'challenge') {
    if (goal.current_challenge_day === 7) badgeKeys.push('milestone_7');
    if (goal.current_challenge_day === 21) badgeKeys.push('milestone_21');
    if (goal.current_challenge_day === 40) badgeKeys.push('milestone_40');
    if (goal.current_challenge_day === 60) badgeKeys.push('milestone_60');
  }

  if ((lifetimeDays ?? 0) >= 100) {
    badgeKeys.push('lifetime_100');
  }

  if (streak >= 30) badgeKeys.push('streak_30');
  if (streak >= 60) badgeKeys.push('streak_60');
  if (streak >= 100) badgeKeys.push('streak_100');
  if (streak >= 365) badgeKeys.push('streak_365');

  if (badgeKeys.length === 0) return;

  const rows = badgeKeys.map((badge_key) => ({
    user_id: userId,
    badge_key,
    goal_id: goal.id,
    day_number: goal.current_challenge_day,
  }));

  await supabase
    .from('user_badges')
    .upsert(rows, { onConflict: 'user_id,badge_key', ignoreDuplicates: true });
}
