import { supabase } from '@/lib/supabase';
import { Goal } from '@/types/database';

/**
 * Canonical id of a goal's CURRENT 77-day challenge run.
 *
 * A restart keeps the same `goals` row and increments `total_restarts`, so
 * `goal_id` alone spans every run. Proof belongs to one run via
 * `progress_photos.challenge_run_id`, whose format is defined only here:
 * `{goal_id}_{total_restarts}`.
 */
export function getChallengeRunId(goal: Pick<Goal, 'id' | 'total_restarts'>): string {
  return `${goal.id}_${goal.total_restarts || 0}`;
}

/**
 * For callers that only hold a goal id. Resolves the goal's current run id,
 * or null if the goal row can't be read.
 */
export async function fetchChallengeRunId(goalId: string): Promise<string | null> {
  const { data } = await supabase
    .from('goals')
    .select('id, total_restarts')
    .eq('id', goalId)
    .maybeSingle();
  return data ? getChallengeRunId(data) : null;
}
