import { supabase } from '@/lib/supabase';
import { computeCurrentStreak } from '@/lib/streakHelpers';

export interface FriendWithStreak {
  id: string;
  username: string;
  display_name: string;
  streak: number;
  goalTitle: string;
  goalId: string | null;
  watchers: number;
  isWatching: boolean;
  photo_url?: string | null;
}

export const friendsKey = (userId: string | undefined) => ['friends', userId];

export async function fetchFriends(userId: string): Promise<FriendWithStreak[]> {
  // Fetch accepted friendships where current user is on either side
  const { data: friendships, error: fErr } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (fErr) throw fErr;
  if (!friendships || friendships.length === 0) {
    return [];
  }

  // Extract friend user IDs (the "other" person)
  const friendIds = friendships.map((f) =>
    f.user_id === userId ? f.friend_id : f.user_id
  );

  // Fetch profiles for friends
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, photo_url')
    .in('id', friendIds);

  if (pErr) throw pErr;

  // Fetch active goals for friends (to compute streak + show goal title)
  const { data: goals, error: gErr } = await supabase
    .from('goals')
    .select('id, user_id, title, is_active')
    .in('user_id', friendIds)
    .eq('is_active', true);

  if (gErr) throw gErr;

  // Fetch watcher counts for each friend
  const { data: watcherCounts, error: wErr } = await supabase
    .from('watchers')
    .select('watched_id')
    .in('watched_id', friendIds);

  if (wErr) throw wErr;

  // Fetch whether current user is watching each friend
  const { data: myWatching, error: mwErr } = await supabase
    .from('watchers')
    .select('watched_id')
    .eq('watcher_id', userId)
    .in('watched_id', friendIds);

  if (mwErr) throw mwErr;

  const myWatchedIds = new Set((myWatching || []).map((w) => w.watched_id));
  const watcherCountMap = new Map<string, number>();
  (watcherCounts || []).forEach((w) => {
    watcherCountMap.set(w.watched_id, (watcherCountMap.get(w.watched_id) || 0) + 1);
  });

  const goalMap = new Map<string, { id: string; title: string }>();
  (goals || []).forEach((g) => {
    if (!goalMap.has(g.user_id)) {
      goalMap.set(g.user_id, { id: g.id, title: g.title });
    }
  });

  // Compute streaks in parallel
  const profileList = profiles || [];
  const streakPromises = profileList.map(async (p) => {
    const goal = goalMap.get(p.id);
    if (goal) {
      try {
        return await computeCurrentStreak(goal.id);
      } catch {
        return 0;
      }
    }
    return 0;
  });
  const streaks = await Promise.all(streakPromises);

  const friendsData: FriendWithStreak[] = profileList.map((p, i) => {
    const goal = goalMap.get(p.id);
    return {
      id: p.id,
      username: p.username || '',
      display_name: p.display_name || p.username || 'Unknown',
      streak: streaks[i] || 0,
      goalTitle: goal?.title || 'No active goal',
      goalId: goal?.id || null,
      watchers: watcherCountMap.get(p.id) || 0,
      isWatching: myWatchedIds.has(p.id),
      photo_url: p.photo_url || null,
    };
  });

  return friendsData;
}
