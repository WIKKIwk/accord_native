import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { QolipHomeBlockReadState, type QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipLocationEntry } from './qolipLocationsApi';

/** Observe real existing Home futures. This hook never starts an API request or supplies an auth boundary. */
export function useQolipHomeBlockRead(blockKey: string, future: Promise<readonly QolipLocationEntry[]>,
  initialLocations: readonly QolipLocationEntry[] | null, boundary: QolipHomeReadBoundary) {
  // initialLocations is FutureBuilder initialData, not a reactive replacement for a settled snapshot.
  const controller = useMemo(() => new QolipHomeBlockReadState(initialLocations, boundary), [blockKey, boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => {
    controller.activate(); controller.bind(future);
    return () => controller.suspend();
  }, [controller, future]);
  return { ...state, controller };
}
