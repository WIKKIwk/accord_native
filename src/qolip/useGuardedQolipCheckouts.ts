import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { createQolipCheckoutRead } from './qolipCheckoutReadRuntime';

/** Unrouted, read-only ledger hook; no return operation or fake action is supplied. */
export function useGuardedQolipCheckouts(session: Session, boundary: QolipHomeReadBoundary) {
  const owner = useMemo(() => createQolipCheckoutRead(session, boundary), [session, boundary]);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => owner.activate(), [owner]);
  return { ...snapshot, owner };
}
