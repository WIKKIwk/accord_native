import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminShellMayEnter } from './adminShellAccess';
import { AdminTopNoticeMessenger } from './adminTopNoticeMessenger';
import type { AdminTopNoticeMessage } from './adminTopNoticeModel';
import { adminTopNoticeService } from './adminTopNoticeRuntime';

/** Account lifetime is original and independent of page focus; genuine provider/host attachment is still required. */
export function createAdminTopNoticeSession(options: Readonly<{ session: Session; witness: SessionWitness; isCurrent: () => boolean;
  mayEnter?: (session: Session | null) => boolean }>) {
  const { session, witness, isCurrent } = options, epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let expired = false, checking = false;
  const current = () => {
    if (expired) return false; if (checking) { expired = true; return false; } checking = true;
    try {
      const original = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && (options.mayEnter ?? adminShellMayEnter)(session);
      if (!original() || !isSynchronouslyTrue(isCurrent) || !original()) expired = true; return !expired;
    } catch { expired = true; return false; } finally { checking = false; }
  };
  const messenger = new AdminTopNoticeMessenger({ isCurrent: current, subscribeCurrent: subscribeSessionWitness });
  return Object.freeze({ messenger, current: messenger.current, show: (value: AdminTopNoticeMessage) => messenger.current() ? adminTopNoticeService.show(messenger, value) : null,
    dismiss: () => { if (messenger.current()) adminTopNoticeService.dismiss(); } });
}
