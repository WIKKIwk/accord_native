import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminProgressQrReport } from './adminProgressQrReportApi';

/** Original scanner/report lifetime, independent of page focus. Construction never starts a request or camera. */
export function createAdminProgressQrReportSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminProgressQrScan);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const guard = () => { if (!current()) throw new Error('Original QR report owner changed'); };
  return Object.freeze({ current, dispose: () => { retired = true; }, read: (qrPayload: string) => { guard(); return adminProgressQrReport(session, qrPayload, guard, current); } });
}
