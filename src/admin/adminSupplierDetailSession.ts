import * as Clipboard from 'expo-clipboard';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminRegenerateSupplierCode, adminRemoveSupplier, adminSetSupplierBlocked, adminSupplierDetail, adminUpdateSupplierPhone } from './adminSupplierDetailApi';
import { AdminSupplierDetailController } from './adminSupplierDetailController';

export function createAdminSupplierDetailSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, ref: string, readOnly = false) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminSupplierDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return { current, controller: new AdminSupplierDetailController({ isCurrent: current, readOnly,
    read: (guard, readWitness) => adminSupplierDetail(session, ref, guard, readWitness),
    status: (detail, blocked, guard) => adminSetSupplierBlocked(session, detail.ref, blocked, guard),
    phone: (detail, phone, guard) => adminUpdateSupplierPhone(session, detail.ref, phone, guard),
    regenerate: guard => adminRegenerateSupplierCode(session, ref, guard), remove: guard => adminRemoveSupplier(session, ref, guard),
    copy: async (text, guard) => { guard(); const copied = await Clipboard.setStringAsync(text); guard(); if (!copied) throw new Error('Clipboard write failed'); },
  }) };
}
