import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { adminSettings, updateAdminSettings } from './adminSettings';
import { AdminSettingsController } from './adminSettingsController';

/** A single original account/epoch/scope is retained for every read, retry and write. */
export function adminSettingsSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let retired = false;
  const current = () => {
    if (retired) return false;
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null &&
      session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
      sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminSettings);
    if (!check() || !isProfileSessionCurrent(isCurrent) || !check()) { retired = true; return false; }
    return true;
  };
  return { current, controller: new AdminSettingsController({ isCurrent: current,
    read: (guard, readWitness) => adminSettings(session, guard, readWitness),
    write: (value, guard) => updateAdminSettings(session, value, guard) }) };
}
