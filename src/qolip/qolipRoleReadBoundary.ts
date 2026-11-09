import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { assertQolipReadCurrent } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

/** No witness is captured here; the settled shell supplies its one original shared-witness boundary. */
export function qolipRoleReadBoundary(session: Session, boundary: QolipHomeReadBoundary): QolipHomeReadBoundary {
  const scope = sessionReadScope(session), original = () => boundary.current();
  let expired = false;
  const current = () => {
    if (expired) return false;
    try {
      const allowed = () => sessionReadScope(session) === scope && session.profile.role === 'qolipchi' &&
        session.capabilities.includes('qolip.manage') && !!activeSessionToken(session) && activeSessionToken(session) !== 'test-mode-token';
      if (!allowed()) { expired = true; return false; }
      assertQolipReadCurrent(original);
      if (!allowed()) { expired = true; return false; }
      return !expired;
    } catch { expired = true; return false; }
  };
  return { current, subscribe: listener => boundary.subscribe(listener) };
}
