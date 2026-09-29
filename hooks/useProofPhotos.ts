import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressPhoto } from '@/types/database';

export function useProofPhotos(challengeDay?: number, challengeRunId?: string | null) {
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
    if (challengeRunId) {
      query = query.eq('challenge_run_id', challengeRunId);
    }
    const { data } = await query;
    setPhotos(data || []);
    setLoading(false);
  }, [user, challengeDay, challengeRunId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return { photos, loading, refresh: loadPhotos };
}

export function useAllProofPhotos(challengeRunId?: string | null) {
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
      .order('challenge_day', { ascending: true });
    if (challengeRunId) {
      query = query.eq('challenge_run_id', challengeRunId);
    }
    const { data } = await query;
    setPhotos(data || []);
    setLoading(false);
  }, [user, challengeRunId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  return { photos, loading, refresh: loadPhotos };
}
