import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { AdminItemCreateOverlayController } from './AdminItemCreateOverlayController';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

export function useAdminItemCreateOverlays(model: AdminItemCreateScreenModel) {
  const { owner, current, nativeCurrent } = model;
  const controller = useMemo(() => new AdminItemCreateOverlayController(owner, current, nativeCurrent), [owner, current, nativeCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  return { ...state, controller };
}
