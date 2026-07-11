import React, { createContext, useContext, useState } from 'react';

type CelebrationContextType = {
  celebrationOpen: boolean;
  openCelebration: () => void;
  closeCelebration: () => void;
};

const CelebrationContext = createContext<CelebrationContextType>({
  celebrationOpen: false,
  openCelebration: () => {},
  closeCelebration: () => {},
});

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  const openCelebration = () => setCelebrationOpen(true);
  const closeCelebration = () => setCelebrationOpen(false);

  return (
    <CelebrationContext.Provider value={{ celebrationOpen, openCelebration, closeCelebration }}>
      {children}
    </CelebrationContext.Provider>
  );
}

export const useCelebration = () => useContext(CelebrationContext);
