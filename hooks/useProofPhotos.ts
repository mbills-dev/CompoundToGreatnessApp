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

  // Permanently deletes ONE proof record (and its stored image). Touches only
  // the progress_photos row: no completions, streak, day, or run state.
  // Resolves true only if a row was actually deleted (RLS can otherwise
  // "succeed" with zero rows).
  const deletePhoto = useCallback(
    async (photo: ProgressPhoto): Promise<boolean> => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('progress_photos')
        .delete()
        .eq('id', photo.id)
        .eq('user_id', user.id)
        .select('id');
      if (error || !data || data.length === 0) {
        console.error('Delete proof failed:', error);
        return false;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));

      // Best-effort storage cleanup so the public URL stops resolving. Skipped
      // if another record still points at the same file (legacy per-day paths).
      try {
        const marker = '/object/public/progress-photos/';
        const at = photo.storage_url.indexOf(marker);
        if (at !== -1) {
          const path = decodeURIComponent(photo.storage_url.slice(at + marker.length));
          const { count } = await supabase
            .from('progress_photos')
            .select('id', { count: 'exact', head: true })
            .eq('storage_url', photo.storage_url);
          if (!count) {
            const { error: removeError } = await supabase.storage
              .from('progress-photos')
              .remove([path]);
            if (removeError) console.warn('Proof image cleanup failed:', removeError);
          }
        }
      } catch (err) {
        console.warn('Proof image cleanup failed (record already deleted):', err);
      }
      return true;
    },
    [user]
  );

  return { photos, loading, refresh: loadPhotos, deletePhoto };
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

