import type { Session } from '../auth';

/** V2's reserved demo token is not proof that the separate persisted test-mode flag is enabled. */
export function isMaterialTestSession(session: Pick<Session, 'token'>): boolean {
  return session.token === 'test-mode-token';
}
