import { activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isMaterialTestSession } from './materialTestSession';

export function materialHistoryCurrent(session: Session, witness: SessionWitness): boolean {
  try {
    // Check first so an observed role/capability loss retires the witness even if a later check denies access.
    return witness.session === session && isSessionWitnessCurrent(witness) && !isMaterialTestSession(session) && !!activeSessionToken(session) &&
      session.profile.role === 'material_taminotchi' && canOpenRoute(session, appRoutes.materialHistory) && isSessionWitnessCurrent(witness);
  } catch { return false; }
}
