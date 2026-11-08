import { currentSession, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';

/** A stale read result is never safe to publish into a different account's UI. */
export function werkaReadScope(session: Session) {
  const scope = sessionReadScope(session);
  return () => {
    if (currentSession() !== session || sessionReadScope(session) !== scope || !session.capabilities.includes('werka.access')) {
      throw new MobileApiException({ code: 'session_scope_changed', message: '' });
    }
  };
}
