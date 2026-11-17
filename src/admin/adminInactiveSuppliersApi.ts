import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { AdminSupplierDetailApiException } from './adminSupplierDetailApi';
import { adminUserCreateSupplierFromJson } from './adminUserCreateModel';

/** The existing AdminSupplier parser is shared with supplier creation. */
export type AdminInactiveSupplier = ReturnType<typeof adminUserCreateSupplierFromJson>;

/** @v2 adminInactiveSuppliers */
export async function adminInactiveSuppliers(session: Session, guard: () => void, readWitness: () => boolean): Promise<readonly AdminInactiveSupplier[]> {
  const check = checkedAdminGuard(guard);
  if (!check || typeof readWitness !== 'function') throw new TypeError('An original inactive supplier read scope is required');
  check();
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/suppliers/inactive', undefined, check, 10_000, { readWitness });
    check();
    if (response.status !== 200) throw new AdminSupplierDetailApiException('Admin inactive suppliers failed');
    const value: unknown = await response.json(); check();
    if (!Array.isArray(value)) throw new TypeError('Invalid inactive supplier list');
    const items = Object.freeze(value.map(adminUserCreateSupplierFromJson)); check(); return items;
  } catch (error) { check(); throw error; }
}
