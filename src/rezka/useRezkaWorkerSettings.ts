import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness, type Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { rezkaMasterAssignWorker, rezkaMasterWorkers } from './rezkaMasterApi';
import { guardedRezkaRequest, isRezkaSessionCurrent, type RezkaSessionSnapshot } from './rezkaSessionGuard';
import { RezkaWorkerSettingsController, rezkaWorkerWriteLocks, type RezkaNotice } from './rezkaWorkerController';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;

export function useRezkaAdminText() {
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  return useCallback((key: string, values: Record<string, string> = {}) => adminText(key, locale, values), [locale]);
}

export function useRezkaNoticeText() {
  const locale = useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
  return useCallback((value: RezkaNotice | null) => {
    if (!value) return '';
    if (value.key !== 'scope.outcome_unknown') return adminText(value.key, locale, value.values ?? {});
    const code = locale.toLowerCase().split(/[-_]/, 1)[0];
    return ({ uz: 'Biriktirma saqlangan bo‘lishi mumkin. Ishchi ma’lumotini tekshiring.',
      en: 'The assignment may have been saved. Check the worker details.',
      ru: 'Назначение могло сохраниться. Проверьте данные работника.',
      ur: 'تفویض محفوظ ہو سکتی ہے۔ کارکن کی تفصیلات چیک کریں۔' } as Record<string, string>)[code] ??
      'The assignment may have been saved. Check the worker details.';
  }, [locale]);
}

export function useRezkaWorkerSettings(session: Session, snapshot: RezkaSessionSnapshot, allowAssignments: boolean) {
  const controller = useMemo(() => new RezkaWorkerSettingsController({
    isCurrent: () => snapshot.session === session && isRezkaSessionCurrent(snapshot, 'master'),
    canWrite: () => allowAssignments && snapshot.session === session && isRezkaSessionCurrent(snapshot, 'master'),
    writeLocks: rezkaWorkerWriteLocks,
    lockKey: workerId => JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref, workerId]),
    loadTeam: () => rezkaMasterWorkers(session, snapshot),
    loadApparatus: () => guardedRezkaRequest(session, 'master', snapshot, false, beforeSend => adminApparatus(session, { limit: 500, beforeSend })),
    save: (workerId, ids, previous) => rezkaMasterAssignWorker(session, workerId, ids, previous, snapshot),
  }), [session, snapshot, allowAssignments]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const t = useRezkaAdminText();
  const leases = useRef(new Map<RezkaWorkerSettingsController, number>());
  useEffect(() => {
    const owners = leases.current;
    controller.resume(); owners.set(controller, (owners.get(controller) ?? 0) + 1);
    const unregister = registerSessionResetHook(async () => controller.invalidate());
    const unwatch = subscribeSessionWitness(() => { if (!isRezkaSessionCurrent(snapshot, 'master')) controller.invalidate(); });
    if (isRezkaSessionCurrent(snapshot, 'master')) void controller.load(); else controller.invalidate();
    return () => {
      controller.suspend(); unregister(); unwatch();
      owners.set(controller, (owners.get(controller) ?? 1) - 1);
      queueMicrotask(() => {
        if (owners.get(controller) === 0) { owners.delete(controller); controller.dispose(); }
      });
    };
  }, [controller, snapshot]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(() => controller.clearNotice(), 5000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const notice = useRezkaNoticeText();
  return { controller, state, t, notice };
}
