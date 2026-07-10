import React, { createContext, useContext, useRef, useState } from 'react';

type RacingBorderContextType = {
  showRacingBorder: boolean;
  triggerRacingBorder: (onComplete?: () => void) => void;
  resetRacingBorder: () => void;
};

const RacingBorderContext = createContext<RacingBorderContextType>({
  showRacingBorder: false,
  triggerRacingBorder: () => {},
  resetRacingBorder: () => {},
});

export function RacingBorderProvider({ children }: { children: React.ReactNode }) {
  const [showRacingBorder, setShowRacingBorder] = useState(false);
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);

  const triggerRacingBorder = (onComplete?: () => void) => {
    onCompleteRef.current = onComplete;
    setShowRacingBorder(true);
  };

  const resetRacingBorder = () => {
    setShowRacingBorder(false);
    if (onCompleteRef.current) {
      onCompleteRef.current();
      onCompleteRef.current = undefined;
    }
  };

  return (
    <RacingBorderContext.Provider value={{ showRacingBorder, triggerRacingBorder, resetRacingBorder }}>
      {children}
    </RacingBorderContext.Provider>
  );
}

export const useRacingBorder = () => useContext(RacingBorderContext);
