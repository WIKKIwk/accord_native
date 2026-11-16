import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminProfileAvatarController } from './adminProfileAvatarController';
import { cachedAdminProfileAvatar, forgetAdminProfileAvatar, loadAdminProfileAvatar } from './adminProfileAvatarRuntime';

/** Parent read authority is independent from parent focus, so an owned preview can remain current. */
export function adminProfileAvatarSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), namespace = JSON.stringify([epoch, scope, witness.generation]); let retired = false, checking = false;
  const current = () => {
    if (retired) return false;
    if (checking) { retired = true; return false; }
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null && session.token !== 'test-mode-token' &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope;
    if (!check()) { retired = true; return false; }
    checking = true; const parentCurrent = isSynchronouslyTrue(isCurrent); checking = false;
    if (!check() || !parentCurrent || retired) { retired = true; return false; } return true;
  };
  const controller = new AdminProfileAvatarController({ isCurrent: current,
    cached: (url, guard) => cachedAdminProfileAvatar(namespace, url, guard), read: (url, guard, signal) => loadAdminProfileAvatar(namespace, url, guard, signal),
    forget: (url, uri, guard) => forgetAdminProfileAvatar(namespace, url, uri, guard) });
  return { current, namespace, controller };
}
