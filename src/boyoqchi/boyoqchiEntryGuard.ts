import { activeSessionToken, type Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

/** A role deep link can only mount for its matching active, authorized session. */
export function canEnterBoyoqchi(session: Session, platform: string, expected: 'ios' | 'android'): boolean {
  return platform === expected && session.profile.role === 'boyoqchi' && !!activeSessionToken(session) &&
    canOpenRoute(session, appRoutes.boyoqchiHome);
}
