import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { appPreferences } from '../appPreferences';
import type { AccountStorage } from '../savedAccountStore';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminWarehouseFilterStore } from './adminWarehouseFilterStore';
import { adminWarehouseFilterRuntime } from './adminWarehouseFilterRuntime';
import { AdminWarehouseMainController } from './adminWarehouseMainController';
import { loadAdminWarehouseMainDetail, loadAdminWarehouseMainSummary, readAdminWarehouseMainItemsPage, readAdminWarehouseMainQolipProducts } from './adminWarehouseMainRead';

/** Account authority is captured once. View focus may gate interactions without retiring background reads. */
export function createAdminWarehouseMainSession(session: Session, witness: SessionWitness, isCurrent: () => boolean,
  options: { storage?: AccountStorage; canInteract?: () => boolean } = {}) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), displayName = session.profile.display_name;
  let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && session.profile.display_name === displayName && canOpenRoute(session, appRoutes.adminWarehouses);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const role = session.profile.role, flags = { adminScoped: role === 'admin' || role === 'brigader', warehouseScoped: role === 'werka' || role === 'material_taminotchi' };
  const storage = options.storage ?? appPreferences, warm = adminWarehouseFilterRuntime(storage, JSON.stringify([scope, displayName]));
  const preferences = new AdminWarehouseFilterStore(storage, String(session.profile.ref ?? ''), current, warm);
  const controller = new AdminWarehouseMainController({ isCurrent: current, canInteract: options.canInteract, adminScoped: flags.adminScoped, preferences,
    summary: (guard, readWitness) => loadAdminWarehouseMainSummary(session, flags, guard, readWitness),
    detail: (warehouse, guard, readWitness) => loadAdminWarehouseMainDetail(session, warehouse, flags, guard, readWitness),
    items: (warehouse, query, offset, guard, readWitness) => readAdminWarehouseMainItemsPage(session, warehouse, query, offset, guard, readWitness),
    qolipProducts: (query, guard, readWitness) => readAdminWarehouseMainQolipProducts(session, query, guard, readWitness),
  });
  let unsubscribe: (() => void) | null = null;
  const activate = () => {
    if (unsubscribe) return;
    const check = () => { if (!current()) controller.invalidate(); };
    unsubscribe = subscribeSessionWitness(check); controller.start(); check();
  };
  const deactivate = () => { unsubscribe?.(); unsubscribe = null; controller.dispose(); };
  return { current, flags, preferences, controller, activate, deactivate,
    onCreated: controller.reload, onChanged: controller.reload, onDeleted: controller.warehouseDeleted, refreshInPlace: controller.refreshInPlace };
}
