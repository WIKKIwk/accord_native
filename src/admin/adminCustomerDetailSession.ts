import * as Clipboard from 'expo-clipboard';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminAssignCustomerItem, AdminCustomerDetailApiException, adminCustomerDetail, adminMaterialTaminotchiDetail, adminRegenerateCustomerCode,
  adminRegenerateMaterialTaminotchiCode, adminRemoveCustomer, adminRemoveCustomerItem, adminUpdateCustomerPhone, adminUpdateMaterialTaminotchiItemGroups,
  adminUpdateMaterialTaminotchiPhone, readAdminCustomerAvailableItems } from './adminCustomerDetailApi';
import { AdminCustomerDetailController } from './adminCustomerDetailController';
import type { AdminUserListEntry } from './adminUsersModel';
import { adminItemGroups } from './itemGroupApi';

/** Source route derives management from the account, and material identity from the original Users entry. */
export function createAdminCustomerDetailSession(session: Session, witness: SessionWitness, isCurrent: () => boolean,
  ref: string, entry: AdminUserListEntry | null = null, readOnly = false) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), target = JSON.stringify([entry?.id, entry?.kind, entry?.principal_role]);
  const material = entry?.kind === 'materialTaminotchi' || entry?.principal_role === 'material_taminotchi';
  const management = !readOnly && session.profile.role !== 'sales_manager' && (session.capabilities.includes('admin.access') || (session.profile.role === 'brigader' && session.capabilities.includes('brigader.access')));
  const mode = Object.freeze({ management, material, items: management && !material, remove: management && !material }); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope &&
        JSON.stringify([entry?.id, entry?.kind, entry?.principal_role]) === target && canOpenRoute(session, appRoutes.adminCustomerDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  const controller = new AdminCustomerDetailController({ isCurrent: current, mode,
    read: (guard, readWitness) => material ? adminMaterialTaminotchiDetail(session, ref, guard, readWitness) : adminCustomerDetail(session, ref, guard, readWitness),
    phone: (detail, phone, guard) => material ? adminUpdateMaterialTaminotchiPhone(session, detail.ref, phone, guard, () => { guard(); return true; }) : adminUpdateCustomerPhone(session, detail.ref, phone, guard),
    regenerate: guard => material ? adminRegenerateMaterialTaminotchiCode(session, ref, guard, () => { guard(); return true; }) : adminRegenerateCustomerCode(session, ref, guard),
    remove: guard => adminRemoveCustomer(session, ref, guard), items: (guard, readWitness) => readAdminCustomerAvailableItems(session, guard, readWitness),
    assign: (item, guard) => adminAssignCustomerItem(session, ref, item.code, guard), unassign: (item, guard) => adminRemoveCustomerItem(session, ref, item.code, guard),
    groups: async (guard, readWitness) => {
      try { return await adminItemGroups(session, guard, readWitness); }
      catch (error) { guard(); if (error instanceof Error && error.message === 'Admin item groups failed') throw new AdminCustomerDetailApiException(error.message); throw error; }
    },
    updateGroups: (detail, groups, guard, readWitness) => adminUpdateMaterialTaminotchiItemGroups(session, detail.ref, groups, guard, readWitness),
    copy: async (code, guard) => { guard(); const copied = await Clipboard.setStringAsync(code); guard(); if (!copied) throw new Error('Clipboard write failed'); },
  });
  return { current, controller, mode };
}
