import { setStringAsync } from 'expo-clipboard';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { adminText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import type { AdminUserListEntry } from './adminUsersModel';
import { adminUserRoleLabel } from './adminUsersModel';
import { adminWorkerDetail, adminWorkerDetailProfile, adminWorkerDetailRegenerateCode, adminWorkerDetailRegenerateSystemCode, adminWorkerDetailSystem,
  adminWorkerDetailUpdatePhone, adminWorkerDetailUpdateSystemPhone } from './adminWorkerDetailApi';
import { adminWorkerDetailAssignedWarehouses, adminWorkerDetailAssignResponsibility, adminWorkerDetailMaterials, adminWorkerDetailResponsibilities,
  adminWorkerDetailUnassignResponsibility, adminWorkerDetailWarehouses } from './adminWorkerDetailAssignmentsApi';
import { AdminWorkerDetailController } from './adminWorkerDetailController';
import { AdminWorkerDetailEditorController } from './adminWorkerDetailEditorController';
import { adminWorkerDetailIsPreparation, adminWorkerDetailIsSystem, adminWorkerDetailWarehouseEnabled, adminWorkerDetailWarehouseRole, type AdminWorkerDetailSystemUser } from './adminWorkerDetailModel';
import { adminAssignWarehouse } from './adminWarehouseAssignmentApi';
import { adminUnassignWarehouse } from './adminWarehouseSettingsApi';
import { dartTrim } from './dartJsonString';

/** Account, target entry and epoch are retained by both editor lifetimes and every command/read continuation. */
export function adminWorkerDetailSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, entry: AdminUserListEntry, readOnly = false) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), target = JSON.stringify([entry.id, entry.kind, entry.principal_role]);
  let retired = false, serial = 0;
  const current = () => {
    if (retired) return false;
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null && session.token !== 'test-mode-token' &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope &&
      JSON.stringify([entry.id, entry.kind, entry.principal_role]) === target && canOpenRoute(session, appRoutes.adminWorkerDetail);
    if (!check() || !isProfileSessionCurrent(isCurrent) || !check()) { retired = true; return false; } return true;
  };
  const workerId = dartTrim(entry.id), system = adminWorkerDetailIsSystem(entry), warehouseRole = adminWorkerDetailWarehouseRole(entry);
  const fromSystem = (user: AdminWorkerDetailSystemUser) => Object.freeze({ id: user.id, name: user.name, phone: user.phone, avatar_url: user.avatar_url,
    level: adminUserRoleLabel(entry), code: user.code, code_locked: user.code_locked, code_retry_after_sec: user.code_retry_after_sec });
  const readWarehouses = (guard: () => void, readWitness: () => boolean) => adminWorkerDetailAssignedWarehouses(session, entry, guard, readWitness);
  const readResponsibilities = (guard: () => void, readWitness: () => boolean) => adminWorkerDetailResponsibilities(session, workerId, guard, readWitness);
  const controller = new AdminWorkerDetailController({ entry, readOnly, isCurrent: current,
    detail: async (guard, readWitness) => system ? fromSystem(await adminWorkerDetailSystem(session, workerId, guard, readWitness)) : adminWorkerDetail(session, workerId, guard, readWitness),
    profile: (guard, readWitness) => adminWorkerDetailProfile(session, workerId, guard, readWitness),
    apparatus: (guard, readWitness) => adminApparatus(session, { limit: 10000, beforeSend: guard, readWitness }), warehouses: readWarehouses, responsibilities: readResponsibilities,
    savePhone: async (detail, phone, guard) => system ? (await adminWorkerDetailUpdateSystemPhone(session, { id: detail.id, role: entry.principal_role, name: detail.name, phone }, guard)).phone
      : (await adminWorkerDetailUpdatePhone(session, detail.id, phone, guard)).phone,
    regenerate: async guard => system ? fromSystem(await adminWorkerDetailRegenerateSystemCode(session, workerId, guard)) : adminWorkerDetailRegenerateCode(session, workerId, guard),
    copy: value => setStringAsync(value),
  });
  const editor = (mode: 'warehouse' | 'material') => new AdminWorkerDetailEditorController({ mode,
    isCurrent: () => controller.isCurrent() && (mode === 'warehouse' ? adminWorkerDetailWarehouseEnabled(entry, readOnly) : adminWorkerDetailIsPreparation(entry) && !readOnly),
    nextId: () => ++serial, name: () => controller.getSnapshot().detail?.name ?? entry.name,
    assignedWarehouses: () => controller.getSnapshot().warehouses, assignedMaterials: () => controller.getSnapshot().responsibilities,
    warehouses: (guard, readWitness) => adminWorkerDetailWarehouses(session, guard, readWitness), materials: (guard, readWitness) => adminWorkerDetailMaterials(session, guard, readWitness),
    assignWarehouse: (warehouse, displayName, guard) => adminAssignWarehouse(session, { warehouse, principal_role: warehouseRole, principal_ref: workerId, display_name: displayName }, guard),
    unassignWarehouse: (warehouse, guard) => adminUnassignWarehouse(session, { warehouse, principal_role: warehouseRole, principal_ref: workerId }, guard), reloadWarehouses: readWarehouses,
    assignMaterial: (materialId, guard) => adminWorkerDetailAssignResponsibility(session, workerId, materialId, guard),
    unassignMaterial: (materialId, guard) => adminWorkerDetailUnassignResponsibility(session, workerId, materialId, guard), reloadMaterials: readResponsibilities,
    changedWarehouses: values => controller.updateWarehouses(values), changedMaterials: values => controller.updateResponsibilities(values),
    text: (key, values) => adminText(key, localeController.locale, values), notice: (key, values) => controller.notice(key, values), rawNotice: message => controller.rawNotice(message),
  });
  return { current, controller, warehouseEditor: editor('warehouse'), materialEditor: editor('material') };
}
