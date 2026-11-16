import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { AdditionalSettingsController } from './additionalSettingsController';
import { additionalSettingsSendGuard } from './additionalSettingsSendGuard';
import { mandatoryAppUpdatesEnabled, setMandatoryAppUpdatesEnabled } from './appUpdateSettingsApi';
import { laminationLabelSettings, paddonManagementSettings, setLaminationLabelSettings, updatePaddonManagementSettings } from './productionSettingsApi';
import { qolipStartSettings, setQolipAutomaticConfirmationEnabled } from './qolipStartSettingsApi';

function createAdditionalSettingsOwner(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  let attached = true;
  const original = additionalSettingsSendGuard(session, witness, isCurrent);
  const guard = (operation?: () => void) => () => {
    if (!attached || !witness) throw new Error('Settings session changed');
    original(); operation?.(); original();
  };
  const current = () => { try { guard()(); return true; } catch { return false; } };
  const read = <T,>(operation: (() => void) | undefined, request: (check: () => void, readWitness: () => boolean) => Promise<T>) => {
    const check = guard(operation), readWitness = () => { try { check(); return true; } catch { return false; } };
    return request(check, readWitness);
  };
  const controller = new AdditionalSettingsController({
    isCurrent: current, scope: () => sessionReadScope(session),
    canOpen: () => canOpenRoute(session, appRoutes.adminAdditionalSettings), isOperator: () => session.profile.role === 'rezka_master',
    readPaddon: op => read(op, (check, readWitness) => paddonManagementSettings(session, check, readWitness)),
    writePaddon: (change, op) => updatePaddonManagementSettings(session, change, guard(op)),
    readAppUpdate: op => read(op, (check, readWitness) => mandatoryAppUpdatesEnabled(session, check, readWitness)),
    writeAppUpdate: (enabled, op) => setMandatoryAppUpdatesEnabled(session, enabled, guard(op)),
    readLamination: op => read(op, (check, readWitness) => laminationLabelSettings(session, check, readWitness)),
    writeLamination: (change, op) => setLaminationLabelSettings(session, change, guard(op)),
    readQolip: op => read(op, (check, readWitness) => qolipStartSettings(session, check, readWitness)),
    writeQolip: (enabled, op) => setQolipAutomaticConfirmationEnabled(session, enabled, guard(op)),
  });
  return { controller, current, attach: () => { attached = true; }, detach: () => { attached = false; controller.dispose(); } };
}

/** One mounted screen owns its witness and every read, retry, confirmation and write. */
export function useAdditionalSettings(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const owner = useMemo(() => createAdditionalSettingsOwner(session, witness, isCurrent), [session, witness, isCurrent]);
  const { controller } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    owner.attach();
    const check = () => { if (!owner.current()) controller.invalidate(); };
    const unsubscribe = subscribeSessionWitness(check);
    const unregister = registerSessionResetHook(async () => { controller.invalidate(); });
    controller.start(); check();
    return () => { unsubscribe(); unregister(); owner.detach(); };
  }, [owner, controller]);
  useEffect(() => {
    if (!state.notice) return;
    const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  return { state, controller, isCurrent: owner.current };
}
