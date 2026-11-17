import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { brigaderDestinationPath, brigaderMayEnter } from './brigaderAccess';

/** Original role/account/scope lifetime. Lost authority never revives an earlier mounted owner. */
export function createBrigaderSession(session: Session, witness: SessionWitness) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let retired = false, checking = false, active = true;
  const isCurrent = (): boolean => {
    if (!active) return false;
    if (retired || checking) { retired = true; return false; }
    checking = true;
    try {
      if (epoch === null || activeSessionEpoch(session) !== epoch || !activeSessionToken(session) || witness.session !== session ||
          !isSynchronouslyTrue(() => isSessionWitnessCurrent(witness)) || sessionReadScope(session) !== scope || !brigaderMayEnter(session)) retired = true;
      return !retired;
    } catch { retired = true; return false; }
    finally { checking = false; }
  };
  return Object.freeze({ isCurrent, activate: () => { active = true; return isCurrent(); }, deactivate: () => { active = false; }, retire: () => { retired = true; },
    destination: (route: string, platform: string) => isCurrent() ? brigaderDestinationPath(session, route, platform) : null });
}

/** Keep the original account available across React's synchronous layout/passive effect replay.
 * Child controllers clear their pending work on cleanup; final detach gates retained callbacks.
 */
export function brigaderSessionLease(owner: ReturnType<typeof createBrigaderSession>, clear: () => void) {
  let mounts = 0;
  return () => {
    mounts++; owner.activate();
    return () => { mounts--; clear(); queueMicrotask(() => { if (mounts === 0) owner.deactivate(); }); };
  };
}
