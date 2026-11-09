import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { QolipSettledHomeSessionOwner } from './qolipSettledHomeSession';

/** Unrouted shell lifetime. It consumes the original shared witness and never renews it. */
export function useQolipSettledHomeSession() {
  const owner = useMemo(() => new QolipSettledHomeSessionOwner(), []);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => owner.activate(), [owner]);
  return snapshot;
}
