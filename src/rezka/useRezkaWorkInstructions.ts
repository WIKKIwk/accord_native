import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness, type Session } from '../auth';
import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import { productionText } from '../shared/localization';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { guardedRezkaRequest, isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { RezkaWorkInstructionsController } from './rezkaWorkInstructionsController';
import { rezkaWorkInstructionsContent } from './rezkaWorkInstructionsModel';
import { useRezkaLocale } from './useRezkaShell';

export function useRezkaWorkInstructions(snapshot: RezkaSessionSnapshot) {
  const isCurrent = useCallback(() => isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusWorkInstructions), [snapshot]);
  const load = useCallback(() => guardedRezkaRequest(snapshot.session, 'master', snapshot, false,
    beforeSend => adminApparatus(snapshot.session, { limit: 300, beforeSend })), [snapshot]);
  return useApparatusWorkInstructions(snapshot.session, isCurrent, load);
}

export function useApparatusWorkInstructions(session: Session, isCurrent: () => boolean, load: () => Promise<AdminApparatus[]>) {
  const controller = useMemo(() => new RezkaWorkInstructionsController({ isCurrent,
    assigned: [...session.assigned_apparatus], load,
  }), [session, isCurrent, load]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const owners = useRef(new Map<RezkaWorkInstructionsController, number>());
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
  const locale = useRezkaLocale(), text = useCallback((key: string, values: Record<string, unknown> = {}) => productionText(key, locale, values), [locale]);
  const content = useMemo(() => rezkaWorkInstructionsContent(state.apparatus, text), [state.apparatus, text]);
  return { state, content, isCurrent };
}
