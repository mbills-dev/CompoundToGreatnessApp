import { SupabaseClient } from '@supabase/supabase-js';
import { Goal, ArchiveReason } from '@/types/database';
import { toLocalDateString } from '@/lib/dateHelpers';

export async function archiveCurrentChallenge(
  goal: Goal,
  supabase: SupabaseClient,
  reason: ArchiveReason
): Promise<void> {
  const { count } = await supabase
    .from('daily_completions')
    .select('id', { count: 'exact', head: true })
    .eq('goal_id', goal.id)
    .not('completed_at', 'is', null);

  const totalActivities = count ?? 0;

  const today = toLocalDateString(new Date());
  const startDate = goal.challenge_start_date
    ? goal.challenge_start_date.split('T')[0]
    : null;

  await supabase.from('challenge_archives').insert({
    user_id: goal.user_id,
    goal_id: goal.id,
    goal_title: goal.title,
    start_date: startDate,
    end_date: today,
    days_completed: goal.current_challenge_day || 0,
    total_activities_completed: totalActivities,
    total_restarts: goal.total_restarts || 0,
    best_streak: goal.best_streak || 0,
    reason,
    identity_statement: goal.identity_statement,
    identity_dimensions: goal.identity_dimensions,
    compass_vision: goal.compass_vision,
    compass_declaration: goal.compass_declaration,
    compass_filter_question: goal.compass_filter_question,
  });
}
