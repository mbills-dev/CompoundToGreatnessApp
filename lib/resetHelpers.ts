import { SupabaseClient } from '@supabase/supabase-js';
import { Goal, ArchiveReason } from '@/types/database';
import { archiveCurrentChallenge } from '@/lib/archiveHelpers';
import { toLocalDateString } from '@/lib/dateHelpers';

/**
 * Full reset sequence:
 * 1. Archive the dead run (if the challenge had started).
 * 2. Delete all daily_completions for this goal.
 * 3. Zero out the challenge progress on the goals row.
 *
 * Returns the updated goal row, or null on error.
 */
export async function resetChallenge(
  goal: Goal,
  supabase: SupabaseClient,
  reason: ArchiveReason,
): Promise<Goal | null> {
  const hadStarted =
    goal.challenge_start_date !== null || (goal.current_challenge_day ?? 0) > 0;

  if (hadStarted) {
    await archiveCurrentChallenge(goal, supabase, reason);
  }

  await supabase
    .from('daily_completions')
    .delete()
    .eq('goal_id', goal.id);

  const { data, error } = await supabase
    .from('goals')
    .update({
      current_challenge_day: 0,
      challenge_start_date: null,
      scheduled_start_date: null,
      last_completion_date: null,
      total_restarts: (goal.total_restarts || 0) + 1,
      grace_period_prompted_date: toLocalDateString(new Date()),
    })
    .eq('id', goal.id)
    .select()
    .single();

  if (error) {
    console.error('Error resetting challenge:', error);
    return null;
  }
  return data;
}
