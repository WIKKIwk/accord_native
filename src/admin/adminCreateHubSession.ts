import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminCreateHubController } from './adminCreateHubController';
import { adminCreateHubPlan } from './adminCreateHubModel';

export function createAdminCreateHubSession(session: Session, witness: SessionWitness, isCurrent: () => boolean,
  available: (route: string) => boolean, openRoute: (route: string) => void | Promise<void>, locale: () => string,
  nextFrame: (callback: () => void) => () => void) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope;
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const plan = () => adminCreateHubPlan(session, locale(), available);
  return { current, controller: new AdminCreateHubController({ isCurrent: current, readiness: plan, actions: () => plan().actions,
    routeAvailable: route => current() && isSynchronouslyTrue(() => available(route)) && current(), openRoute, nextFrame }) };
}
