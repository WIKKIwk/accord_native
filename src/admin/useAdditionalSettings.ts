import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { AdditionalSettingsController } from './additionalSettingsController';
import { additionalSettingsSendGuard } from './additionalSettingsSendGuard';
import { mandatoryAppUpdatesEnabled, setMandatoryAppUpdatesEnabled } from './appUpdateSettingsApi';
import { laminationLabelSettings, paddonManagementSettings, setLaminationLabelSettings, updatePaddonManagementSettings } from './productionSettingsApi';
import { qolipStartSettings, setQolipAutomaticConfirmationEnabled } from './qolipStartSettingsApi';

export function useAdditionalSettings(session: Session) {
  const controller = useMemo(() => new AdditionalSettingsController({
    isCurrent: () => !!activeSessionToken(session), scope: () => sessionReadScope(session),
    canOpen: () => canOpenRoute(session, appRoutes.adminAdditionalSettings),
    isOperator: () => session.profile.role === 'rezka_master',
    readPaddon: () => paddonManagementSettings(session, additionalSettingsSendGuard(session)),
    writePaddon: change => updatePaddonManagementSettings(session, change, additionalSettingsSendGuard(session)),
    readAppUpdate: () => mandatoryAppUpdatesEnabled(session, additionalSettingsSendGuard(session)),
    writeAppUpdate: enabled => setMandatoryAppUpdatesEnabled(session, enabled, additionalSettingsSendGuard(session)),
    readLamination: () => laminationLabelSettings(session, additionalSettingsSendGuard(session)),
    writeLamination: change => setLaminationLabelSettings(session, change, additionalSettingsSendGuard(session)),
    readQolip: () => qolipStartSettings(session, additionalSettingsSendGuard(session)),
    writeQolip: enabled => setQolipAutomaticConfirmationEnabled(session, enabled, additionalSettingsSendGuard(session)),
  }), [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const unregister = registerSessionResetHook(async () => { controller.invalidate(); });
    controller.start();
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  useEffect(() => {
    if (!state.notice) return;
    const serial = state.notice.serial, timer = setTimeout(() => controller.dismissNotice(serial), 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  return { state, controller };
}
