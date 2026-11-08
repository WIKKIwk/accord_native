import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { activeSessionEpoch, registerSessionResetHook, type Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaMasterAssignWorker, rezkaMasterWorkers } from './rezkaMasterApi';
import { currentRezkaScope, isRezkaSessionCurrent } from './rezkaSessionGuard';
import { RezkaWorkerSettingsController, type RezkaNotice } from './rezkaWorkerController';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;

export function useRezkaAdminText() {
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  return useCallback((key: string, values: Record<string, string> = {}) => adminText(key, locale, values), [locale]);
}

export function useRezkaWorkerSettings(session: Session) {
  const scope = currentRezkaScope(session), epoch = activeSessionEpoch(session);
  const snapshot = useMemo(() => Object.freeze({ session, scope, epoch }), [session, scope, epoch]);
  const controller = useMemo(() => new RezkaWorkerSettingsController({
    isCurrent: () => isRezkaSessionCurrent(snapshot, 'master'),
    loadTeam: () => rezkaMasterWorkers(session, snapshot),
    loadApparatus: () => adminApparatus(session, { limit: 500 }),
    save: (workerId, ids, previous) => rezkaMasterAssignWorker(session, workerId, ids, previous, snapshot),
  }), [session, snapshot]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const t = useRezkaAdminText();
  const leases = useRef(new Map<RezkaWorkerSettingsController, number>());
  useEffect(() => {
    const owners = leases.current;
    owners.set(controller, (owners.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    void controller.load();
    return () => {
      unregister();
      owners.set(controller, (owners.get(controller) ?? 1) - 1);
      queueMicrotask(() => {
        if (owners.get(controller) === 0) { owners.delete(controller); controller.dispose(); }
      });
    };
  }, [controller]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => controller.clearNotice(), 5000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const notice = (value: RezkaNotice | null) => value ? t(value.key, value.values) : '';
  return { controller, state, t, notice };
}
