import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminShellMayEnter } from './adminShellAccess';
import { AdminRootPresentationChain } from './adminRootPresentationChain';

/** Captured Auth invalidation retires Source work. The chain retains original native resources separately;
 * neither this subscription nor an account loss supplies native removal/readiness proof. */
export function createAdminRootPresentationSession(options: Readonly<{
  session: Session; witness: SessionWitness; isCurrent: () => boolean; rootIdentity: object; platform: 'android' | 'ios';
}>) {
  const { session, witness, isCurrent, rootIdentity, platform } = options, epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let retired = false, checking = false;
  const current = () => {
    if (retired) return false; if (checking) { retired = true; return false; } checking = true;
    try {
      const original = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && adminShellMayEnter(session);
      if (!original() || !isSynchronouslyTrue(isCurrent) || !original()) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return new AdminRootPresentationChain({ platform, rootIdentity, isCurrent: current, subscribeCurrent: subscribeSessionWitness });
}
