import { supabase } from '@/lib/supabase';

export type InboxItem = {
  id: string;
  source: 'friend' | 'public';
  senderName: string;
  message: string | null;
  emoji: string | null;
  createdAt: string;
  readAt: string | null;
};

export async function getInboxItems(userId: string): Promise<InboxItem[]> {
  const [encouragementsRes, leadsRes] = await Promise.all([
    supabase
      .from('encouragements')
      .select(
        'id, from_user_id, message, emoji, created_at, read_at, profiles!encouragements_from_user_id_fkey(display_name)',
      )
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('journey_leads')
      .select('id, name, message, created_at, read_at')
      .eq('watched_user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (encouragementsRes.error) {
    console.error('getInboxItems encouragements query failed:', encouragementsRes.error);
  }
  if (leadsRes.error) {
    console.error('getInboxItems journey_leads query failed:', leadsRes.error);
  }

  const friendItems: InboxItem[] = (encouragementsRes.data || [])
    .filter((row: any) => row.message !== null)
    .map((row: any) => ({
    id: row.id,
    source: 'friend' as const,
    senderName: row.profiles?.display_name || 'Someone',
    message: row.message,
    emoji: row.emoji,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));

  const publicItems: InboxItem[] = (leadsRes.data || []).map((row: any) => ({
    id: row.id,
    source: 'public' as const,
    senderName: row.name || 'Anonymous',
    message: row.message,
    emoji: null,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));

  return [...friendItems, ...publicItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getUnreadInboxCount(userId: string): Promise<number> {
  const [encouragementsRes, leadsRes] = await Promise.all([
    supabase
      .from('encouragements')
      .select('id', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .not('message', 'is', null)
      .is('read_at', null),
    supabase
      .from('journey_leads')
      .select('id', { count: 'exact', head: true })
      .eq('watched_user_id', userId)
      .is('read_at', null),
  ]);

  return (encouragementsRes.count || 0) + (leadsRes.count || 0);
}

export async function markInboxItemRead(item: InboxItem): Promise<void> {
  const table = item.source === 'friend' ? 'encouragements' : 'journey_leads';
  const { error } = await supabase
    .from(table)
    .update({ read_at: new Date().toISOString() })
    .eq('id', item.id)
    .is('read_at', null);

  if (error) throw error;
}
