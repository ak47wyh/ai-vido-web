import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Create default space if none exist (side effect in useEffect, not in render)
  useEffect(() => {
    if (spaces !== undefined && spaces.length === 0) {
      storySpaceService.createSpace('Default Space', 'Default workspace').then(space => {
        setExplicitSpaceId(space.id);
      }).catch(console.error);
    }
  }, [spaces]);

  // Derive currentSpaceId: explicit selection > first space > null (loading)
  const currentSpaceId = (() => {
    if (spaces === undefined) return null; // still loading
    if (explicitSpaceId !== null && spaces.find(s => s.id === explicitSpaceId)) {
      return explicitSpaceId;
    }
    // Fall back to first space
    return spaces.length > 0 ? spaces[0].id : null;
  })();

  return (
    <SpaceContext.Provider value={{ currentSpaceId, setCurrentSpaceId: setExplicitSpaceId }}>
      {children}
    </SpaceContext.Provider>
  );
};
