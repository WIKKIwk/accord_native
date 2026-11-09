import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { createQolipHomeOwner } from './qolipReadOnlyHomeOwnerRuntime';

/** Read-only initial loads, search and explicit failed-read retry; no lifecycle refresh or mutation. */
export function useReadOnlyQolipHome(session: Session, boundary: QolipHomeReadBoundary) {
  const owner = useMemo(() => createQolipHomeOwner(session, boundary), [session, boundary]);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => { const actions = owner.activate(); return () => owner.suspend(actions); }, [owner]);
  return snapshot;
}
