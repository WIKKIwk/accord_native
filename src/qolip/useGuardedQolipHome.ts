import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Session } from '../auth';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { createQolipHomeOwner } from './qolipHomeOwnerRuntime';

/** An unrouted owner. A real shell must inject its original reviewed shared-witness boundary. */
export function useGuardedQolipHome(session: Session, boundary: QolipHomeReadBoundary) {
  const owner = useMemo(() => createQolipHomeOwner(session, boundary), [session, boundary]);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => {
    const actions = owner.activate();
    if (!actions) return;
    const unsubscribe = qolipDataRevision.subscribe(() => actions.locationsChanged());
    const appState = AppState.addEventListener('change', value => { if (value === 'active') actions.appResumed(); });
    return () => { appState.remove(); unsubscribe(); owner.suspend(actions); };
  }, [owner]);
  const actions = snapshot.actions;
  useFocusEffect(useCallback(() => {
    actions?.routeChanged(true);
    return () => actions?.routeChanged(false);
  }, [actions]));
  return snapshot;
}
