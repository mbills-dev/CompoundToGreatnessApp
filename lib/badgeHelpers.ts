import { supabase } from '@/lib/supabase';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import { toLocalDateString } from '@/lib/dateHelpers';
import { Goal } from '@/types/database';

export async function checkAndAwardBadges(userId: string, goal: Goal): Promise<string[]> {
  const streak = await computeCurrentStreak(goal.id);

  const { count: lifetimeDays } = await supabase
    .from('daily_completions')
    .select('completion_date', { count: 'exact', head: true })
    .eq('goal_id', goal.id)
    .not('completed_at', 'is', null);

  const badgeKeys: string[] = [];

  if (goal.current_challenge_day >= 77) {
    badgeKeys.push('day_77_complete');
  }

  if (goal.current_challenge_day >= 1) badgeKeys.push('milestone_1');
  if (goal.current_challenge_day >= 7) badgeKeys.push('milestone_7');
  if (goal.current_challenge_day >= 21) badgeKeys.push('milestone_21');
  if (goal.current_challenge_day >= 40) badgeKeys.push('milestone_40');
  if (goal.current_challenge_day >= 60) badgeKeys.push('milestone_60');

  if ((lifetimeDays ?? 0) >= 100) {
    badgeKeys.push('lifetime_100');
  }
  if ((lifetimeDays ?? 0) >= 250) {
    badgeKeys.push('lifetime_250');
  }
  if ((lifetimeDays ?? 0) >= 500) {
    badgeKeys.push('lifetime_500');
  }

  if (streak >= 3) badgeKeys.push('streak_3');
  if (streak >= 14) badgeKeys.push('streak_14');
  if (streak >= 30) badgeKeys.push('streak_30');
  if (streak >= 60) badgeKeys.push('streak_60');
  if (streak >= 100) badgeKeys.push('streak_100');
  if (streak >= 365) badgeKeys.push('streak_365');

  // Evidence log counts — evidence_logs has no user_id, join via goals.
  const { count: evidenceCount } = await supabase
    .from('evidence_logs')
    .select('id, goal_id!inner', { count: 'exact', head: true })
    .eq('goal_id.user_id', userId);

  const evCount = evidenceCount ?? 0;
  if (evCount >= 1) badgeKeys.push('evidence_first');
  if (evCount >= 10) badgeKeys.push('evidence_10');
  if (evCount >= 30) badgeKeys.push('evidence_30');
  if (evCount >= 100) badgeKeys.push('evidence_100');

  // Progress photo count — progress_photos has a direct user_id column.
  const { count: photoCount } = await supabase
    .from('progress_photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((photoCount ?? 0) >= 1) badgeKeys.push('photo_first');

  // Perfect Week — all 7 days of the current Mon–Sun week have a completion.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0 = Sun ... 6 = Sat
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offsetToMonday);
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(toLocalDateString(d));
  }
  const { data: weekCompletions } = await supabase
    .from('daily_completions')
    .select('completion_date')
    .eq('goal_id', goal.id)
    .not('completed_at', 'is', null)
    .in('completion_date', weekDates);
  const completedWeekDates = new Set((weekCompletions || []).map((c) => c.completion_date));
  if (weekDates.every((d) => completedWeekDates.has(d))) {
    badgeKeys.push('perfect_week');
  }

  // Weekend Warrior — last 4 completed Sat+Sun pairs all have both days.
  const { data: weekendCompletions } = await supabase
    .from('daily_completions')
    .select('completion_date')
    .eq('goal_id', goal.id)
    .not('completed_at', 'is', null)
    .order('completion_date', { ascending: false })
    .limit(1000);
  const completedSet = new Set((weekendCompletions || []).map((c) => c.completion_date));
  const weekends: { sat: string; sun: string }[] = [];
  const cursor = new Date(today);
  while (weekends.length < 4) {
    const dow = cursor.getDay();
    if (dow === 6) {
      // cursor is Saturday
      const satStr = toLocalDateString(cursor);
      const sun = new Date(cursor);
      sun.setDate(cursor.getDate() + 1);
      const sunStr = toLocalDateString(sun);
      if (completedSet.has(satStr) && completedSet.has(sunStr)) {
        weekends.push({ sat: satStr, sun: sunStr });
      }
      // Jump back a week to the previous Saturday.
      cursor.setDate(cursor.getDate() - 7);
    } else {
      // Step back to the previous Saturday.
      cursor.setDate(cursor.getDate() - 1);
      // Guard against infinite loop if data is sparse.
      if (toLocalDateString(cursor) < '2000-01-01') break;
    }
  }
  if (weekends.length >= 4) {
    badgeKeys.push('weekend_warrior');
  }

  // Early Riser — 5+ completions with a LOCAL hour before 8.
  const { data: earlyRows } = await supabase
    .from('daily_completions')
    .select('completed_at')
    .eq('goal_id', goal.id)
    .not('completed_at', 'is', null)
    .limit(1000);
  let earlyCount = 0;
  for (const r of earlyRows || []) {
    // completed_at is an ISO timestamp; interpret in local time (browser/device TZ).
    const local = new Date(r.completed_at as string);
    if (local.getHours() < 8) {
      earlyCount++;
    }
  }
  if (earlyCount >= 5) badgeKeys.push('early_riser');

  // Comeback — streak >= 7 AND has at least one archived challenge.
  if (streak >= 7) {
    const { count: archiveCount } = await supabase
      .from('challenge_archives')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((archiveCount ?? 0) >= 1) {
      badgeKeys.push('comeback');
    }
  }

  if (badgeKeys.length === 0) return [];

  // Fetch existing badge keys so we can compute which candidates are genuinely new.
  const { data: existing, error: existingErr } = await supabase
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', userId);
  if (existingErr) {
    console.error('checkAndAwardBadges existing fetch failed:', existingErr);
    throw existingErr;
  }
  const existingSet = new Set((existing || []).map((b) => b.badge_key));
  const newKeys = badgeKeys.filter((k) => !existingSet.has(k));

  const rows = badgeKeys.map((badge_key) => ({
    user_id: userId,
    badge_key,
    goal_id: goal.id,
    day_number: goal.current_challenge_day,
  }));

  const { error } = await supabase
    .from('user_badges')
    .upsert(rows, { onConflict: 'user_id,badge_key', ignoreDuplicates: true });
  if (error) {
    console.error('checkAndAwardBadges upsert failed:', error);
    throw error;
  }

  return newKeys;
}

export async function awardWatcherBadges(watchedUserId: string): Promise<void> {
  const { count, error } = await supabase
    .from('watchers')
    .select('id', { count: 'exact', head: true })
    .eq('watched_id', watchedUserId);
  if (error) throw error;

  const keys: string[] = [];
  if (count === 1) keys.push('watcher_first');
  if ((count ?? 0) >= 5) keys.push('watcher_5');
  if (keys.length === 0) return;

  const { error: upsertErr } = await supabase
    .from('user_badges')
    .upsert(
      keys.map((badge_key) => ({ user_id: watchedUserId, badge_key })),
      { onConflict: 'user_id,badge_key', ignoreDuplicates: true }
    );
  if (upsertErr) throw upsertErr;
}

export async function awardEncouragementBadge(fromUserId: string): Promise<void> {
  const { count, error } = await supabase
    .from('encouragements')
    .select('id', { count: 'exact', head: true })
    .eq('from_user_id', fromUserId);
  if (error) throw error;

  if ((count ?? 0) < 10) return;

  const { error: upsertErr } = await supabase
    .from('user_badges')
    .upsert(
      [{ user_id: fromUserId, badge_key: 'encourage_10' }],
      { onConflict: 'user_id,badge_key', ignoreDuplicates: true }
    );
  if (upsertErr) throw upsertErr;
}

export async function awardInviteBadge(inviterId: string): Promise<void> {
  const { count, error } = await supabase
    .from('watcher_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', inviterId)
    .not('accepted_by', 'is', null);
  if (error) throw error;

  if ((count ?? 0) < 1) return;

  const { error: upsertErr } = await supabase
    .from('user_badges')
    .upsert(
      [{ user_id: inviterId, badge_key: 'invite_accepted' }],
      { onConflict: 'user_id,badge_key', ignoreDuplicates: true }
    );
  if (upsertErr) throw upsertErr;
}

export async function awardSignedBadge(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_badges')
    .upsert(
      [{ user_id: userId, badge_key: 'signed' }],
      { onConflict: 'user_id,badge_key', ignoreDuplicates: true }
    );
  if (error) throw error;
}
