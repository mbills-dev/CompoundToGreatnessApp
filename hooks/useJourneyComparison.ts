import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface JourneyPhoto {
  id: string;
  challenge_day: number;
  storage_url: string;
  is_milestone: boolean;
}

export interface JourneyStats {
  earliestPhoto: JourneyPhoto | null;
  latestPhoto: JourneyPhoto | null;
  photoCount: number;
  perfectDays: number;
  daysCompleted: number;
}

export function useJourneyComparison(goalId: string, currentChallengeDay: number) {
  const { user } = useAuth();
  const [stats, setStats] = useState<JourneyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && goalId) {
      loadData();
    }
  }, [user, goalId]);

  const loadData = async () => {
    try {
      const [photosRes, completionsRes] = await Promise.all([
        supabase
          .from('progress_photos')
          .select('id, challenge_day, storage_url, is_milestone')
          .eq('goal_id', goalId)
          .eq('user_id', user!.id)
          .order('challenge_day', { ascending: true }),
        supabase
          .from('daily_completions')
          .select('activities_completed')
          .eq('goal_id', goalId),
      ]);

      const photos: JourneyPhoto[] = photosRes.data || [];
      const completions = completionsRes.data || [];

      const perfectDays = completions.filter((c) => {
        const acts: string[] = c.activities_completed || [];
        return acts.length > 0;
      }).length;

      if (photos.length < 2) {
        setStats(null);
        return;
      }

      setStats({
        earliestPhoto: photos[0],
        latestPhoto: photos[photos.length - 1],
        photoCount: photos.length,
        perfectDays,
        daysCompleted: currentChallengeDay,
      });
    } catch (err) {
      console.error('Error loading journey data:', err);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading };
}
