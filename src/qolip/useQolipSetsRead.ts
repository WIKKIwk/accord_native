import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { createQolipSetsRead } from './qolipSetsReadRuntime';

/** The real owner supplies the original witness and source mutation lock. No write or retry is exposed. */
export function useQolipSetsRead(session: Session, boundary: QolipHomeReadBoundary, saving: boolean) {
  const owner = useMemo(() => createQolipSetsRead(session, boundary, saving), [session, boundary]); // eslint-disable-line react-hooks/exhaustive-deps
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => owner.activate(), [owner]);
  useLayoutEffect(() => owner.updateSaving(saving), [owner, saving]);
  return snapshot;
}
