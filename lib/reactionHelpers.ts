import { supabase } from './supabase';

export interface ReactionGroup {
  emoji: string;
  count: number;
  senderName?: string;
  senderPhotoUrl?: string;
}

export async function checkForNewReactions(userId: string): Promise<ReactionGroup[]> {
  const { data, error } = await supabase
    .from('encouragements')
    .select('emoji, from_user_id')
    .eq('to_user_id', userId)
    .is('message', null)
    .is('read_at', null);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch all unique sender profiles in one query
  const senderIds = [...new Set(data.map((r: any) => r.from_user_id).filter(Boolean))];
  const senderMap: Record<string, { display_name: string | null; photo_url: string | null }> = {};
  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, photo_url')
      .in('id', senderIds);
    if (profiles) {
      for (const p of profiles) {
        senderMap[p.id] = { display_name: p.display_name, photo_url: p.photo_url };
      }
    }
  }

  // Group by emoji+sender so toasts are per-sender
  const grouped: Record<string, ReactionGroup> = {};
  for (const row of data) {
    const emoji = row.emoji || '';
    if (!emoji) continue;
    const senderId = row.from_user_id || '';
    const key = `${emoji}::${senderId}`;
    const sender = senderMap[senderId];
    if (grouped[key]) {
      grouped[key].count += 1;
    } else {
      grouped[key] = {
        emoji,
        count: 1,
        senderName: sender?.display_name ?? undefined,
        senderPhotoUrl: sender?.photo_url ?? undefined,
      };
    }
  }

  return Object.values(grouped);
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
