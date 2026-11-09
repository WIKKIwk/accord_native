import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { RezkaPaddonApparatusController } from './rezkaPaddonApparatusController';
import { guardedRezkaRequest, isRezkaSessionCurrent, RezkaScopeChanged, type RezkaSessionSnapshot } from './rezkaSessionGuard';

/** Prepared for the future drawer; no Paddon destination is exposed by this hook. */
export function useRezkaPaddonApparatus(snapshot: RezkaSessionSnapshot) {
  const isCurrent = useCallback(() => isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddons), [snapshot]);
  const controller = useMemo(() => new RezkaPaddonApparatusController({ isCurrent,
    assigned: [...snapshot.session.assigned_apparatus],
    load: () => guardedRezkaRequest(snapshot.session, 'master', snapshot, false,
      beforeSend => adminApparatus(snapshot.session, { limit: 10000, beforeSend: () => {
        if (!isCurrent()) throw new RezkaScopeChanged(false);
        beforeSend();
      } })),
  }), [snapshot, isCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const owners = useRef(new Map<RezkaPaddonApparatusController, number>());
  useEffect(() => {
    const leases = owners.current;
    controller.resume(); leases.set(controller, (leases.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    const unwatch = subscribeSessionWitness(() => { if (!isCurrent()) controller.invalidate(); });
    if (isCurrent()) void controller.start(); else controller.invalidate();
    return () => {
      controller.suspend(); unregister(); unwatch(); leases.set(controller, (leases.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (leases.get(controller) === 0) { leases.delete(controller); controller.dispose(); } });
    };
  }, [controller, isCurrent]);
  return { state, isCurrent };
}
