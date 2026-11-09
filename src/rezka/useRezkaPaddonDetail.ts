import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { RezkaPaddonDetailController } from './rezkaPaddonDetailController';
import { createRezkaPaddonDetailOwner, rezkaPaddonDetailOwnerInput, subscribeRezkaPaddonDetailOwner } from './rezkaPaddonDetailLifetime';
import { isRezkaPaddonDetailBinding, readRezkaPaddonDetail } from './rezkaPaddonDetailRead';
import { isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';

class DetailViewLifetime {
  private active = true;
  constructor(readonly snapshot: RezkaSessionSnapshot, readonly apparatusId: string, readonly code: string) {}
  isActive() { return this.active; }
  resume() { this.active = true; }
  suspend() { this.active = false; }
}

/** Prepared for a future reviewed host; this hook does not expose a route or action. */
export function useRezkaPaddonDetail(snapshot: RezkaSessionSnapshot, apparatusId: string, code: string) {
  const lifetime = useMemo(() => new DetailViewLifetime(snapshot, apparatusId, code), [snapshot, apparatusId, code]);
  useLayoutEffect(() => { lifetime.resume(); return () => { lifetime.suspend(); }; }, [lifetime]);
  const isCurrent = useCallback(() => lifetime.isActive() && isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddonDetail), [snapshot, lifetime]);
  const controller = useMemo(() => new RezkaPaddonDetailController({ isCurrent,
    createOwner: () => createRezkaPaddonDetailOwner(snapshot, apparatusId, code),
    ownerCurrent: owner => !!rezkaPaddonDetailOwnerInput(owner), subscribeOwner: subscribeRezkaPaddonDetailOwner,
    load: readRezkaPaddonDetail, accept: binding => isRezkaPaddonDetailBinding(binding, snapshot),
  }), [snapshot, apparatusId, code, isCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const owners = useRef(new Map<RezkaPaddonDetailController, number>());
  useEffect(() => {
    const leases = owners.current;
    controller.resume(); leases.set(controller, (leases.get(controller) ?? 0) + 1);
    if (isCurrent()) void controller.start(); else controller.invalidate();
    return () => {
      controller.suspend(); leases.set(controller, (leases.get(controller) ?? 1) - 1);
      queueMicrotask(() => { if (leases.get(controller) === 0) { leases.delete(controller); controller.dispose(); } });
    };
  }, [controller, isCurrent]);
  return { state, controller, isCurrent };
}
