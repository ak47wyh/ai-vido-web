import React, { createContext, useContext, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { storySpaceService } from '../../dependencies';

interface SpaceContextType {
  currentSpaceId: string | null;
  setCurrentSpaceId: (id: string | null) => void;
}

const SpaceContext = createContext<SpaceContextType>({
  currentSpaceId: null,
  setCurrentSpaceId: () => {},
});

function useSpaceContext() {
  return useContext(SpaceContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export { useSpaceContext as useSpace };

export const SpaceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const spaces = useLiveQuery(() => db.storySpaces.toArray());
  const [explicitSpaceId, setExplicitSpaceId] = useState<string | null>(null);

  const currentSpaceId = useMemo(() => {
    if (spaces === undefined) return null;
    if (spaces.length === 0) {
      // No spaces exist yet — create a default one asynchronously
      storySpaceService.createSpace('Default Space', 'Default workspace').then(space => {
        setExplicitSpaceId(space.id);
      });
      return null;
    }
    if (explicitSpaceId !== null && spaces.find(s => s.id === explicitSpaceId)) {
      return explicitSpaceId;
    }
    // Fall back to first space
    return spaces[0].id;
  }, [spaces, explicitSpaceId]);

  return (
    <SpaceContext.Provider value={{ currentSpaceId, setCurrentSpaceId: setExplicitSpaceId }}>
      {children}
    </SpaceContext.Provider>
  );
};
