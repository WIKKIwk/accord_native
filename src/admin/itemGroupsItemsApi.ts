import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { dartTrim } from './dartJsonString';

/** AdminItemGroupItemsTab uses 40-row adminItemsPage reads without changing the legacy GScale owner. */
export async function itemGroupsItemsPage(session: Session, group: string, offset: number, guard: () => void, readWitness: () => boolean): Promise<SupplierItem[]> {
  try {
    const query = new URLSearchParams({ group: dartTrim(group), limit: '40' });
    if (offset > 0) query.set('offset', String(offset));
    guard();
    const response = await authorizedFetch(session, `/v1/mobile/admin/items?${query}`, {}, guard, 10_000, { readWitness });
    guard();
    if (response.status !== 200) throw new Error('Admin items failed');
    const data: unknown = await response.json(); guard();
    if (!Array.isArray(data)) throw new TypeError('Invalid list');
    const result = data.map(supplierItemFromJson); guard(); return result;
  } catch (error) { guard(); throw error; }
}
