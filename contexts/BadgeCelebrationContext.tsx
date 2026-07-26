import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import BadgeCelebrationModal from '@/components/BadgeCelebrationModal';

export interface BadgeInfo {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  image_url: string | null;
}

type BadgeCelebrationContextType = {
  celebrateBadge: (badgeKey: string) => void;
};

const BadgeCelebrationContext = createContext<BadgeCelebrationContextType>({
  celebrateBadge: () => {},
});

export function BadgeCelebrationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [queue, setQueue] = useState<string[]>([]);
  const [activeBadge, setActiveBadge] = useState<BadgeInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const celebrateBadge = useCallback((badgeKey: string) => {
    setQueue((prev) => {
      if (prev.includes(badgeKey)) return prev;
      return [...prev, badgeKey];
    });
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['badge-count', user.id] });
    }
  }, [user?.id, queryClient]);

  const headKey = queue[0] ?? null;

  useEffect(() => {
    if (!headKey || activeBadge?.key === headKey) return;

    let cancelled = false;
    setLoading(true);

    Promise.resolve(
      supabase
        .from('badges')
        .select('key, title, description, icon, color, image_url')
        .eq('key', headKey)
        .maybeSingle()
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error || !data) {
          setQueue((prev) => prev.filter((k, i) => i !== 0));
          return;
        }
        setActiveBadge(data as BadgeInfo);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setQueue((prev) => prev.filter((k, i) => i !== 0));
      });

    return () => {
      cancelled = true;
    };
  }, [headKey, activeBadge?.key]);

  const handleDone = useCallback(() => {
    setActiveBadge(null);
    setQueue((prev) => prev.slice(1));
  }, []);

  return (
    <BadgeCelebrationContext.Provider value={{ celebrateBadge }}>
      {children}
      {activeBadge && !loading && (
        <BadgeCelebrationModal badge={activeBadge} onDone={handleDone} />
      )}
    </BadgeCelebrationContext.Provider>
  );
}

export function useBadgeCelebration(): BadgeCelebrationContextType {
  return useContext(BadgeCelebrationContext);
}
