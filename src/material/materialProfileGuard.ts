import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isMaterialTestSession } from './materialTestSession';

/** Preserve the shell's one captured witness for Profile reads and edits. */
export function materialProfileCurrent(session: Session, witness: SessionWitness): boolean {
  return witness.session === session && !isMaterialTestSession(session) && session.profile.role === 'material_taminotchi' &&
    canOpenRoute(session, appRoutes.materialHome) && isSessionWitnessCurrent(witness);
}
