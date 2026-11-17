import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { AdminItemCreateOverlayController, type AdminItemCreatePresentedMove } from './AdminItemCreateOverlayController';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

export function useAdminItemCreateOverlays(model: AdminItemCreateScreenModel) {
  const { owner, current, moveNativeCurrent } = model;
  // An accepted original native close outlives a replacement interaction resolver.
  // New commands keep their own render's immutable guard instead of retargeting old native callbacks.
  const controller = useMemo(() => new AdminItemCreateOverlayController(owner, current), [owner, current]);
  const chooseMove = useCallback((ticket: AdminItemCreatePresentedMove, confirmed: boolean) => controller.chooseMove(ticket, confirmed, moveNativeCurrent), [controller, moveNativeCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => { controller.start(); return () => controller.dispose(); }, [controller]);
  return { ...state, controller, chooseMove };
}
