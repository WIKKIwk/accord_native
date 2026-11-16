import { adminApparatus } from '../apparatusApi';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { adminProgressQrOpeningWipReport, adminProgressQrPaddonReport } from './adminProgressQrFallbackApi';
import { AdminProgressQrLookupController, type AdminProgressQrLookupDependencies } from './adminProgressQrLookupController';
import { adminProgressQrMaterialLookup } from './adminProgressQrMaterialApi';
import { adminProgressQrReport } from './adminProgressQrReportApi';
import { adminUserPrincipalRoleFromJson } from './adminUsersModel';

export type AdminProgressQrLookupSessionOptions = Readonly<{
  session: Session; witness: SessionWitness; isCurrent: () => boolean; scanOnly: boolean;
}> & Pick<AdminProgressQrLookupDependencies, 'canInteract' | 'scanner' | 'returnScan' | 'replaceWorkerQueue'>;
/** Real API binding to one original account/scope. A scanner/navigation adapter is required; construction does not activate it. */
export function createAdminProgressQrLookupSession(options: AdminProgressQrLookupSessionOptions) {
  const { session, witness } = options, epoch = activeSessionEpoch(session), scope = sessionReadScope(session), parent = createProfileSessionGuard(options.isCurrent);
  const principalRole = adminUserPrincipalRoleFromJson(session.profile.role); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminProgressQrScan);
      if (!valid() || !parent() || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const controller = new AdminProgressQrLookupController({ isCurrent: current, canInteract: options.canInteract, scanner: options.scanner,
    returnScan: options.returnScan, replaceWorkerQueue: options.replaceWorkerQueue,
    primary: (value, guard, readWitness) => adminProgressQrReport(session, value, guard, readWitness),
    paddon: (value, guard, readWitness) => adminProgressQrPaddonReport(session, value, guard, readWitness),
    opening: (value, guard, readWitness) => adminProgressQrOpeningWipReport(session, value, guard, readWitness),
    material: (value, guard, readWitness) => adminProgressQrMaterialLookup(session, value, guard, readWitness),
    apparatus: (guard, readWitness) => adminApparatus(session, { limit: 10000, beforeSend: guard, readWitness }),
  }, options.scanOnly, principalRole);
  return Object.freeze({ current, controller });
}
