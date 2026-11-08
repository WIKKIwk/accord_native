import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { activeSessionToken } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { canOpenRoute } from '../shared/appRoutes';
import { AdminHomeController } from './adminHomeController';
import { adminHomeCanLoadSummary } from './adminHomeModel';
import type { AdminHomeScreenProps } from './adminHomeTypes';

const afterFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
export function useAdminHome({ session, store, hub, isRouteAvailable }: AdminHomeScreenProps) {
  const controller = useMemo(() => new AdminHomeController({ store, hub, afterFrame,
    isCurrent: () => !!activeSessionToken(session), scope: () => sessionReadScope(session),
    canLoadSummary: () => adminHomeCanLoadSummary(session), canOpen: route => canOpenRoute(session, route) && isRouteAvailable(route),
  }), [session, store, hub, isRouteAvailable]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  return { state, controller };
}
