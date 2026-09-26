import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressPhoto } from '@/types/database';

export function useProofPhotos(challengeDay?: number) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPhotos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (challengeDay != null) {
      query = query.eq('challenge_day', challengeDay);
    }
    const { data } = await query;
    setPhotos(data || []);
    setLoading(false);
  }, [user, challengeDay]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return { photos, loading, refresh: loadPhotos };
}

export function useAllProofPhotos() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPhotos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('challenge_day', { ascending: true });
    setPhotos(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return { photos, loading, refresh: loadPhotos };
}
