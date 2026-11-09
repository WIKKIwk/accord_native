import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { createQolipHomeOwner } from './qolipHomeOwnerRuntime';

/** Initial reads and search only. No route/resume refresh, retry or mutation is exposed. */
export function useReadOnlyQolipHome(session: Session, boundary: QolipHomeReadBoundary) {
  const owner = useMemo(() => createQolipHomeOwner(session, boundary), [session, boundary]);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => { const actions = owner.activate(); return () => owner.suspend(actions); }, [owner]);
  return snapshot;
}
