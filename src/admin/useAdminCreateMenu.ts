import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness } from '../auth';
import { AdminCreateMenuController, type AdminMenuAction } from './adminCreateMenuController';

export type AdminCreateMenuProps = { actions: readonly AdminMenuAction[]; isCurrent: () => boolean;
  openLabel: string; closeLabel: string; bottomOffset?: number; visible?: boolean };

export function useAdminCreateMenu({ actions, isCurrent, visible = true }: AdminCreateMenuProps) {
  const controller = useMemo(() => new AdminCreateMenuController(actions, isCurrent,
    () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))), [actions, isCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useLayoutEffect(() => {
    controller.activate();
    const unsubscribe = subscribeSessionWitness(() => controller.recheck()); controller.recheck();
    return () => { unsubscribe(); controller.detach(); };
  }, [controller]);
  useLayoutEffect(() => { controller.setVisible(visible); }, [visible, controller]);
  return { state, controller };
}
