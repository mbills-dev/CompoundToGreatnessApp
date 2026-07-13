import { supabase } from './supabase';

export interface ReactionGroup {
  emoji: string;
  count: number;
}

export async function checkForNewReactions(userId: string): Promise<ReactionGroup[]> {
  const { data, error } = await supabase
    .from('encouragements')
    .select('emoji')
    .eq('to_user_id', userId)
    .is('message', null)
    .is('read_at', null);

  console.log('[reaction-raw] userId:', userId);
  console.log('[reaction-raw] data:', data);
  console.log('[reaction-raw] error:', error);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const grouped: Record<string, number> = {};
  for (const row of data) {
    const emoji = row.emoji || '';
    if (emoji) {
      grouped[emoji] = (grouped[emoji] || 0) + 1;
    }
  }

  return Object.entries(grouped).map(([emoji, count]) => ({ emoji, count }));
}

export async function markReactionsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('encouragements')
    .update({ read_at: new Date().toISOString() })
    .eq('to_user_id', userId)
    .is('message', null)
    .is('read_at', null);

  if (error) throw error;
}
