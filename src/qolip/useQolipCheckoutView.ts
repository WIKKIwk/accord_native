import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipCheckoutLocks } from './qolipCheckoutSelectionState';
import { createQolipCheckoutView } from './qolipCheckoutViewRuntime';

/** Unrouted composition. Real action locks are required; no return or retry callback is provided. */
export function useQolipCheckoutView(session: Session, boundary: QolipHomeReadBoundary, locks: QolipCheckoutLocks) {
  const owner = useMemo(() => createQolipCheckoutView(session, boundary, locks), [session, boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  const lockKey = JSON.stringify([...locks.returningIds].sort()), bulkReturning = locks.bulkReturning;
  useLayoutEffect(() => owner.activate(), [owner]);
  useLayoutEffect(() => owner.updateLocks({ returningIds: new Set<string>(JSON.parse(lockKey)), bulkReturning }), [owner, lockKey, bulkReturning]);
  return snapshot;
}
