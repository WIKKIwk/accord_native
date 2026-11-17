import { activeSessionEpoch, currentSession, isSessionWitnessCurrent, logout, type Session, type SessionWitness } from '../auth';
import { clearAppLock } from '../appLock';
import { switchPinStore } from '../shared/switchPinRuntime';
import { brigaderMayEnter } from './brigaderAccess';

/** @v2 AccountSwitchController.logoutCurrent
 * Source removes local security after server/account removal and before clearing the active session.
 */
export async function logoutBrigader(session: Session, witness: SessionWitness): Promise<void> {
  if (witness.session !== session || !isSessionWitnessCurrent(witness) || !brigaderMayEnter(session)) return;
  const epoch = activeSessionEpoch(session), identity = JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref]);
  if (epoch === null) return;
  // Logout itself retires the UI witness. Its storage cleanup keeps only this original active-session lifetime.
  const current = () => currentSession() === session && activeSessionEpoch(session) === epoch &&
    JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref]) === identity;
  await logout(session, { beforeClearSession: async () => {
    await clearAppLock(session, current);
    await switchPinStore.clear(session, current);
  } });
}
