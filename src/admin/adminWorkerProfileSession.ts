import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminUserListEntry } from './adminUsersModel';
import { adminWorkerDetailProfile } from './adminWorkerDetailApi';
import { AdminWorkerProfileController } from './adminWorkerProfileController';

export function createAdminWorkerProfileSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, entry: AdminUserListEntry) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), id = entry.id; let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && entry.id === id && canOpenRoute(session, appRoutes.adminWorkerProfileDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return { current, controller: new AdminWorkerProfileController({ isCurrent: current,
    detail: (guard, readWitness) => adminWorkerDetailProfile(session, id, guard, readWitness),
    apparatus: (guard, readWitness) => adminApparatus(session, { limit: 10000, beforeSend: guard, readWitness }) }) };
}
