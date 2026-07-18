import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export const settingsBundleKey = (userId: string | undefined) => ['settings-bundle', userId];

export async function fetchSettingsBundle(user: User) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('photo_url, username')
    .eq('id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  let settings = data;
  if (!settings) {
    const metadata = user.user_metadata || {};
    const { data: newSettings, error: insertError } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        first_name: metadata.first_name || '',
        last_name: metadata.last_name || '',
        email: user.email || '',
      })
      .select()
      .single();

    if (insertError) throw insertError;
    settings = newSettings;
  }

  return { profile: profile ?? null, settings };
}
