import { useCallback, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';

/** A reset permanently retires this particular captured witness, even if the session later appears unchanged. */
export function useRezkaPaddonDetailAccess(snapshot: RezkaSessionSnapshot): boolean {
  const retired = useRef(new WeakSet<RezkaSessionSnapshot>());
  const current = useCallback(() => isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddonDetail), [snapshot]);
  const subscribe = useCallback((listener: () => void) => {
    const invalidateIfStale = () => { if (!current()) { retired.current.add(snapshot); listener(); } };
    const unwatch = subscribeSessionWitness(invalidateIfStale);
    const unregister = registerSessionResetHook(async () => { retired.current.add(snapshot); listener(); });
    invalidateIfStale();
    return () => { unwatch(); unregister(); };
  }, [snapshot, current]);
  const getSnapshot = useCallback(() => !retired.current.has(snapshot) && current(), [snapshot, current]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
