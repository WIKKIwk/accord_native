import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { ensureProfileAvatar } from '../shared/profileAvatarRuntime';
import { AdminProfileActionController } from './adminProfileActionController';

export function createAdminProfileActionSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope;
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return { current, controller: new AdminProfileActionController({ isCurrent: current,
    load: (profile, guard) => ensureProfileAvatar(session, profile, guard) }) };
}
