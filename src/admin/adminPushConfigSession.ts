import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminPushConfigScreenProps } from './AdminPushConfigScreenTypes';
import { adminPushConfig, checkAdminPushConfig, saveAdminPushConfig, saveMobilePushConfig, testAdminPushConfig } from './adminPushConfigApi';
import { AdminPushConfigController } from './adminPushConfigController';
import { pickAdminPushConfigFile } from './adminPushConfigFiles';

/** One original account/epoch/scope owns the screen, native picker and device-registration adapter. */
export function adminPushConfigSession({ session, witness, isCurrent, device, deviceTokenProvider, pickFile }:
  Pick<AdminPushConfigScreenProps, 'session' | 'witness' | 'isCurrent' | 'device' | 'deviceTokenProvider' | 'pickFile'>) {
  const parent = createProfileSessionGuard(isCurrent), epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let retired = false;
  const current = () => {
    if (retired) return false;
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope;
    if (!check() || !parent() || !check()) { retired = true; return false; } return true;
  };
  const allowed = () => current() && session.profile.role === 'admin' && canOpenRoute(session, appRoutes.adminPushConfig);
  const controller = new AdminPushConfigController({ isCurrent: allowed, device, deviceTokenProvider,
    read: guard => adminPushConfig(session, guard), save: (account, guard) => saveAdminPushConfig(session, account, guard),
    check: guard => checkAdminPushConfig(session, guard), test: (token, guard) => testAdminPushConfig(session, token, guard),
    saveMobile: (platform, client, guard) => saveMobilePushConfig(session, platform, client, guard), pick: pickFile ?? pickAdminPushConfigFile });
  return { current, allowed, controller };
}
