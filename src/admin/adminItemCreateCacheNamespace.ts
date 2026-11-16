import { activeSessionEpoch, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';

/** Capture before the owner's first request; never compute a fresh namespace for a late acknowledgement. */
export function adminItemCreateCacheNamespace(session: Session, witness: SessionWitness): string | null {
  try {
    const epoch = activeSessionEpoch(session);
    if (epoch === null || witness.session !== session || !isSessionWitnessCurrent(witness)) return null;
    return JSON.stringify([epoch, witness.generation, sessionReadScope(session)]);
  } catch { return null; }
}
