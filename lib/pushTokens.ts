import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token: tokenResult.data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );

    if (error) console.error('registerPushToken: upsert error', error.message);
  } catch (err) {
    console.error('registerPushToken: failed', err);
  }
}
