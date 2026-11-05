import { activeSessionToken, type Session } from './auth';
/** @v2 requireToken */
export function requireToken(session: Session): string {
  const token = activeSessionToken(session)?.trim();
  if (!token) throw new Error('No session token');
  return token;
}
