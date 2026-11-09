import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook, type Session } from '../auth';
import { QolipSetNameState } from './qolipSetNameState';
import type { QolipManagedSet } from './qolipSetsApi';

export function useQolipSetName(session: Session, entry: QolipManagedSet) {
  const controller = useMemo(() => QolipSetNameState.forSession(session, entry), [session, entry]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.dispose(); });
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, controller };
}
