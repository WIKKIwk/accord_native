import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { canOpenRoute, appRoutes } from '../shared/appRoutes';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaMasterAssignWorker, rezkaMasterWorkers } from './rezkaMasterApi';
import { currentRezkaScope } from './rezkaSessionGuard';
import { RezkaWorkerSettingsController, type RezkaNotice } from './rezkaWorkerSettings';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;

export function useRezkaWorkerSettings(session: Session) {
  const scope = currentRezkaScope(session);
  const controller = useMemo(() => new RezkaWorkerSettingsController({
    isCurrent: () => !!activeSessionToken(session) && currentRezkaScope(session) === scope &&
      session.profile.role === 'rezka_master' && canOpenRoute(session, appRoutes.adminWorkerSettings),
    loadTeam: () => rezkaMasterWorkers(session, scope),
    loadApparatus: () => adminApparatus(session, { limit: 500 }),
    save: (workerId, ids, previous) => rezkaMasterAssignWorker(session, workerId, ids, previous, scope),
  }), [session, scope]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  const lease = useMemo(() => ({ mounts: 0 }), [controller]);
  useEffect(() => {
    lease.mounts++;
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    void controller.load();
    return () => {
      unregister();
      lease.mounts--;
      queueMicrotask(() => { if (lease.mounts === 0) controller.dispose(); });
    };
  }, [controller, lease]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => controller.clearNotice(), 5000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const t = (key: string, values: Record<string, string> = {}) => adminText(key, locale, values);
  const notice = (value: RezkaNotice | null) => value ? t(value.key, value.values) : '';
  return { controller, state, t, notice };
}
