import { activeSessionToken, type Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

/** A role deep link can only mount for the active session allowed by V2 route capabilities. */
export function canEnterBoyoqchi(session: Session, platform: string, expected: 'ios' | 'android'): boolean {
  return platform === expected && !!activeSessionToken(session) && canOpenRoute(session, appRoutes.boyoqchiHome);
}
