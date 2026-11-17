import { activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isMaterialTestSession } from './materialTestSession';

/** The receipt retains the Material shell's original account and role lifetime. */
export function materialReceiptCurrent(session: Session, witness: SessionWitness): boolean {
  try {
    return witness.session === session && isSessionWitnessCurrent(witness) && !!activeSessionToken(session) &&
      !isMaterialTestSession(session) && session.profile.role === 'material_taminotchi' &&
      canOpenRoute(session, appRoutes.gscaleMode) && isSessionWitnessCurrent(witness);
  } catch { return false; }
}
