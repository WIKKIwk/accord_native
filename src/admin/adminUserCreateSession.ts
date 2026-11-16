import * as Clipboard from 'expo-clipboard';
import { adminApparatus } from '../apparatusApi';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import type { AdminUserCreateScreenProps } from './AdminUserCreateScreenTypes';
import { adminCustomerUpsertRoleAssignment, adminRegenerateCustomerCode } from './adminCustomerDetailApi';
import { adminItemCreateCacheNamespace } from './adminItemCreateCacheNamespace';
import { clearAdminItemCreateCustomerCache } from './adminItemCreateRuntime';
import { adminSettings, updateAdminSettings } from './adminSettings';
import { adminUsersCache } from './adminUsersRuntime';
import { adminRegenerateWerkaCode } from './adminWerkaApi';
import { adminWorkerDetailRegenerateSystemCode } from './adminWorkerDetailApi';
import { createAdminUserCreateCustomer, createAdminUserCreateMaterial, createAdminUserCreateSupplier, createAdminUserCreateSystem, readAdminUserCreateRoles } from './adminUserCreateApi';
import { AdminUserCreateController } from './adminUserCreateController';
import type { AdminUserCreateCustomer } from './adminUserCreateModel';
import { adminItemGroups } from './itemGroupApi';

export function createAdminUserCreateSession(props: Pick<AdminUserCreateScreenProps, 'session' | 'witness' | 'isCurrent' | 'mode'> & { initialName?: string }, customerCreated?: (value: AdminUserCreateCustomer) => void) {
  const { session, witness, isCurrent, mode } = props, parent = createProfileSessionGuard(isCurrent), epoch = activeSessionEpoch(session), scope = sessionReadScope(session), customerCache = adminItemCreateCacheNamespace(session, witness);
  const route = mode === 'customer' ? appRoutes.adminCustomerCreate : appRoutes.adminUserCreate; let retired = false;
  const current = () => {
    if (retired) return false;
    const valid = () => customerCache !== null && typeof session.profile.role === 'string' && epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, route);
    if (!valid() || !parent() || !valid()) retired = true; return !retired;
  };
  const options = Object.freeze({ customerOnly: mode === 'customer' || session.profile.role === 'sales_manager', returnCustomer: mode === 'customer', initialName: props.initialName ?? '',
    principalRole: typeof session.profile.role === 'string' ? session.profile.role : '', capabilities: Object.freeze([...session.capabilities]) });
  const controller = new AdminUserCreateController({ current, roles: (guard, readWitness) => readAdminUserCreateRoles(session, guard, readWitness),
    apparatus: (guard, readWitness) => adminApparatus(session, { limit: 200, beforeSend: guard, readWitness }), groups: (guard, readWitness) => adminItemGroups(session, guard, readWitness),
    settings: (guard, readWitness) => adminSettings(session, guard, readWitness), updateSettings: (value, guard) => updateAdminSettings(session, value, guard), regenerateWerka: guard => adminRegenerateWerkaCode(session, guard),
    customer: (name, phone, guard) => createAdminUserCreateCustomer(session, name, phone, guard), supplier: (name, phone, guard) => createAdminUserCreateSupplier(session, name, phone, guard),
    material: (name, phone, groups, guard) => createAdminUserCreateMaterial(session, name, phone, groups, guard), system: (role, name, phone, guard) => createAdminUserCreateSystem(session, role, name, phone, guard),
    regenerateCustomer: (ref, guard) => adminRegenerateCustomerCode(session, ref, guard), regenerateSystem: (id, guard) => adminWorkerDetailRegenerateSystemCode(session, id, guard),
    assign: (assignment, guard) => adminCustomerUpsertRoleAssignment(session, assignment, guard), invalidateUsers: () => adminUsersCache.invalidate(), customerCreated,
    invalidateCustomerPicker: () => { if (customerCache === null) throw new Error('Original customer cache scope is missing'); clearAdminItemCreateCustomerCache(customerCache); },
    copy: async (value, guard) => { guard(); const copied = await Clipboard.setStringAsync(value); guard(); if (!copied) throw new Error('Clipboard write failed'); },
  }, options);
  return { current, controller, options };
}
