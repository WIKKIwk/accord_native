import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { checkedAdminGuard } from './adminProductionRequest';
import { AdminSupplierDetailApiException } from './adminSupplierDetailApi';
import { adminSupplierDetailFromJson, type AdminSupplierDetail } from './adminSupplierDetailModel';
import { dartQueryComponent } from './dartUri';

async function body(session: Session, path: string, init: RequestInit | undefined, failure: string, guard?: () => void, witness?: () => boolean): Promise<unknown> {
  const check = checkedAdminGuard(guard); if (witness !== undefined && (!check || typeof witness !== 'function')) throw new TypeError('Supplier items scoped read requires guard and witness');
  check?.();
  try {
    const response = witness === undefined ? await authorizedFetch(session, path, init, check) : await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness });
    check?.(); if (response.status !== 200) throw new AdminSupplierDetailApiException(failure);
    const value: unknown = await response.json(); check?.(); return value;
  } catch (error) { check?.(); throw error; }
}
/** @v2 adminAssignedSupplierItems */
export async function adminAssignedSupplierItems(session: Session, ref: string, guard?: () => void, witness?: () => boolean): Promise<readonly SupplierItem[]> {
  const value = await body(session, `/v1/mobile/admin/suppliers/items/assigned?ref=${dartQueryComponent(ref)}`, undefined, 'Admin assigned supplier items failed', guard, witness);
  try { if (!Array.isArray(value)) throw new TypeError('Invalid assigned supplier items'); return Object.freeze(value.map(supplierItemFromJson)); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminAssignSupplierItem */
export async function adminAssignSupplierItem(session: Session, ref: string, itemCode: string, guard?: () => void): Promise<AdminSupplierDetail> {
  const value = await body(session, `/v1/mobile/admin/suppliers/items/add?ref=${dartQueryComponent(ref)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_code: itemCode }) }, 'Admin assign supplier item failed', guard);
  try { return adminSupplierDetailFromJson(value); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminRemoveSupplierItem */
export async function adminRemoveSupplierItem(session: Session, ref: string, itemCode: string, guard?: () => void): Promise<AdminSupplierDetail> {
  const value = await body(session, `/v1/mobile/admin/suppliers/items/remove?ref=${dartQueryComponent(ref)}&item_code=${dartQueryComponent(itemCode)}`, { method: 'DELETE' }, 'Admin remove supplier item failed', guard);
  try { return adminSupplierDetailFromJson(value); } finally { checkedAdminGuard(guard)?.(); }
}
