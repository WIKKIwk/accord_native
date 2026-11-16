import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminUserCreateCustomerFromJson } from './adminUserCreateModel';
import { dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';

class AdminItemCreateCustomersException extends Error { toString() { return `Exception: ${this.message}`; } }
/** @v2 adminCustomers
 * Existing Werka/private directory defaults remain unchanged.
 */
export async function readAdminItemCreateCustomers(session: Session, options: { query?: string; limit?: number; offset?: number }, guard: () => void, witness: () => boolean) {
  const check = checkedAdminGuard(guard); if (!check || typeof witness !== 'function') throw new TypeError('Customer picker requires its original guard and witness'); check();
  const query = dartTrim(options.query ?? ''), limit = options.limit ?? 20, offset = options.offset ?? 0;
  const parts = [...(query ? [`q=${dartQueryComponent(query)}`] : []), ...(limit > 0 ? [`limit=${limit}`] : []), ...(offset > 0 ? [`offset=${offset}`] : [])];
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/customers/list${parts.length ? `?${parts.join('&')}` : ''}`, {}, check, 10_000, { readWitness: witness }); check();
    if (response.status !== 200) throw new AdminItemCreateCustomersException('Admin customers failed'); const value: unknown = await response.json(); check();
    try { if (!Array.isArray(value)) throw new TypeError('Invalid customer list'); return Object.freeze(value.map(adminUserCreateCustomerFromJson)); } finally { check(); }
  } catch (error) { check(); throw error; }
}
