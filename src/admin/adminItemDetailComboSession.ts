import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminItemDetailCombo, adminItemDetailComboProductName, canReadAdminItemDetailCombo } from './adminItemDetailComboApi';
import { AdminItemDetailComboController, AdminItemDetailComboProductNameController } from './adminItemDetailComboController';
import type { AdminItemDetailComboProduct } from './adminItemDetailComboPresentation';

/** Catalog and actual product-row readers share the original account, never a later account or a replacement catalog entry. */
export function createAdminItemDetailComboSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, itemCode: string) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminItemDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const controller = new AdminItemDetailComboController(itemCode, { isCurrent: current, canRead: () => canReadAdminItemDetailCombo(session),
    read: (code, guard, readWitness) => adminItemDetailCombo(session, code, guard, readWitness) });
  const productName = (product: AdminItemDetailComboProduct, hostCurrent: () => boolean) => {
    const entry = controller.getSnapshot().entry;
    if (!current() || !controller.isCurrent() || !entry?.template.products.includes(product)) return null;
    let closed = false, checkingRow = false;
    const rowCurrent = () => {
      if (closed || checkingRow) { closed = true; return false; } checkingRow = true;
      try {
        const valid = () => current() && controller.isCurrent() && controller.getSnapshot().entry === entry;
        if (!valid() || !isSynchronouslyTrue(hostCurrent) || !valid() || closed) closed = true; return !closed;
      } catch { closed = true; return false; } finally { checkingRow = false; }
    };
    return new AdminItemDetailComboProductNameController(product, { isCurrent: rowCurrent,
      read: (code, guard, readWitness) => adminItemDetailComboProductName(session, code, guard, readWitness) });
  };
  return { current, controller, productName };
}
