import { activeSessionEpoch, currentSession, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';

/** A stale read result is never safe to publish into a different account's UI. */
export function werkaReadScope(session: Session) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  return () => {
    if (epoch === null || activeSessionEpoch(session) !== epoch || currentSession() !== session ||
        sessionReadScope(session) !== scope || !session.capabilities.includes('werka.access')) {
      throw new MobileApiException({ code: 'session_scope_changed', message: '' });
    }
  };
}
