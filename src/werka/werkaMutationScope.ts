import { currentSession, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { MobileApiException } from '../shared/mobileApiException';

/** The prior request may have reached the server; callers must not infer cancellation or retry automatically. */
export class WerkaMutationScopeError extends MobileApiException {
  constructor(readonly requestMayHaveBeenSent: boolean) {
    super({ code: 'session_scope_changed', message: '' });
  }
}

/** Capture permission and identity before a mutation, then check both before every send and after awaits. */
export function werkaMutationScope(session: Session) {
  const scope = sessionReadScope(session);
  let mayHaveBeenSent = false;
  const check = () => {
    if (currentSession() !== session || sessionReadScope(session) !== scope || !session.capabilities.includes('werka.access')) {
      throw new WerkaMutationScopeError(mayHaveBeenSent);
    }
  };
  return {
    beforeSend: () => { check(); mayHaveBeenSent = true; },
    afterResponse: check,
  };
}
