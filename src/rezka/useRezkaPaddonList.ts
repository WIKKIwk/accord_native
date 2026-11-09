import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter, productionText } from '../shared/localization';
import { RezkaPaddonListController } from './rezkaPaddonListController';
import { rezkaPaddonListContent } from './rezkaPaddonListModel';
import { readRezkaPaddons } from './rezkaPaddonRead';
import { guardedRezkaRequest, isRezkaSessionCurrent, RezkaScopeChanged, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { useRezkaLocale } from './useRezkaShell';

/** Prepared for a future reviewed host. No route or Paddon mutation is attached. */
export function useRezkaPaddonList(snapshot: RezkaSessionSnapshot, routeId = '', routeName = '') {
  const isCurrent = useCallback(() => isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddons), [snapshot]);
  const controller = useMemo(() => new RezkaPaddonListController({ isCurrent, assigned: [...snapshot.session.assigned_apparatus], routeId, routeName,
    loadApparatus: () => guardedRezkaRequest(snapshot.session, 'master', snapshot, false,
      beforeSend => adminApparatus(snapshot.session, { limit: 10000, beforeSend: () => {
        if (!isCurrent()) throw new RezkaScopeChanged(false);
        beforeSend();
      } })),
    loadPaddons: apparatus => readRezkaPaddons(snapshot, apparatus),
  }), [snapshot, routeId, routeName, isCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const owners = useRef(new Map<RezkaPaddonListController, number>());
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
  const locale = useRezkaLocale();
  const t = useCallback((key: string, values: Record<string, unknown> = {}) => productionText(key, locale, values), [locale]);
  const content = useMemo(() => rezkaPaddonListContent(state, t, localizedGetter('retry', locale)), [state, t, locale]);
  return { state, content, controller, isCurrent };
}
