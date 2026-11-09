import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { QolipSettledHomeSessionOwner } from './qolipReadOnlySettledHomeSession';

/** Unrouted shell lifetime. It consumes the original shared witness and never renews it. */
export function useReadOnlyQolipSettledHomeSession() {
  const owner = useMemo(() => new QolipSettledHomeSessionOwner(), []);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => owner.activate(), [owner]);
  return snapshot;
}
