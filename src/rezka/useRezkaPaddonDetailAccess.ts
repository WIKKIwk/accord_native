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
    const notify = () => {
      try {
        const result: unknown = listener();
        if (result && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
      } catch { /* A view subscriber must not fail a session reset. */ }
    };
    const invalidateIfStale = () => { if (!current()) { retired.current.add(snapshot); notify(); } };
    const unwatch = subscribeSessionWitness(invalidateIfStale);
    const unregister = registerSessionResetHook(async () => { retired.current.add(snapshot); notify(); });
    invalidateIfStale();
    return () => { unwatch(); unregister(); };
  }, [snapshot, current]);
  const getSnapshot = useCallback(() => !retired.current.has(snapshot) && current(), [snapshot, current]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
