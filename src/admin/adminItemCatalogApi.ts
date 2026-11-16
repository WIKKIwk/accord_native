import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { checkedAdminGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';
import { adminItemMutationError } from './itemGroupApi';
import { adminItemGroupBulkMoveResultFromJson, type AdminItemGroupBulkMoveResult } from './itemGroupModel';

export class AdminItemCatalogApiException extends Error { toString(): string { return `Exception: ${this.message}`; } }
type Guard = () => void;
export type AdminCatalogItemsOptions = Readonly<{ query?: string; group?: string; limit?: number; offset?: number }>;
export type AdminCatalogItemInput = Readonly<{ code: string; name: string; uom: string; itemGroup: string; customerRef?: string }>;

function requiredGuard(guard: Guard): Guard {
  const check = checkedAdminGuard(guard); if (!check) throw new TypeError('Admin item catalog requires its original guard'); return check;
}
async function read(session: Session, path: string, failure: string, guard: Guard, witness: () => boolean): Promise<unknown> {
  const check = requiredGuard(guard); if (typeof witness !== 'function') throw new TypeError('Admin item catalog read requires its original witness');
  check();
  try {
    const response = await authorizedFetch(session, path, {}, check, 10_000, { readWitness: witness }); check();
    if (response.status !== 200) throw new AdminItemCatalogApiException(failure);
    const value: unknown = await response.json(); check(); return value;
  } catch (error) { check(); throw error; }
}
/** Scoped source adminItemsPage; the legacy GScale/Item Groups readers retain their defaults. */
export async function adminCatalogItemsPage(session: Session, options: AdminCatalogItemsOptions, guard: Guard, witness: () => boolean): Promise<readonly SupplierItem[]> {
  const check = requiredGuard(guard); check();
  const query = dartTrim(options.query ?? ''), group = dartTrim(options.group ?? ''), limit = options.limit ?? 50, offset = options.offset ?? 0;
  const parts = [...(query ? [`q=${dartQueryComponent(query)}`] : []), ...(group ? [`group=${dartQueryComponent(group)}`] : []),
    ...(limit > 0 ? [`limit=${limit}`] : []), ...(offset > 0 ? [`offset=${offset}`] : [])];
  const value = await read(session, `/v1/mobile/admin/items${parts.length ? `?${parts.join('&')}` : ''}`, 'Admin items failed', check, witness);
  try { if (!Array.isArray(value)) throw new TypeError('Invalid admin item list'); return Object.freeze(value.map(supplierItemFromJson)); } finally { check(); }
}
/** Scoped source adminItemUoms; source filtering preserves duplicate/order and accepts an empty catalog. */
export async function adminCatalogItemUoms(session: Session, guard: Guard, witness: () => boolean): Promise<readonly string[]> {
  const check = requiredGuard(guard), value = await read(session, '/v1/mobile/admin/items/uoms', 'Admin item UOMs failed', check, witness);
  try {
    if (!Array.isArray(value)) throw new TypeError('Invalid admin UOM list');
    return Object.freeze(value.filter((item): item is string => typeof item === 'string').map(dartTrim).filter(Boolean));
  } finally { check(); }
}
async function mutate(session: Session, path: string, body: unknown, fallbackCode: string, fallbackMessage: string, guard: Guard): Promise<unknown> {
  const check = requiredGuard(guard); check();
  try {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; check();
    const response = await authorizedFetch(session, path, init, check); check();
    if (response.status !== 200) { const error = await adminItemMutationError(response, fallbackCode, fallbackMessage); check(); throw error; }
    const value: unknown = await response.json(); check(); return value;
  } catch (error) { check(); throw error; }
}
/** @v2 adminCreateItem */
export async function createAdminCatalogItem(session: Session, input: AdminCatalogItemInput, guard: Guard): Promise<SupplierItem> {
  const check = requiredGuard(guard); check(); const code = dartTrim(input.code), customerRef = dartTrim(input.customerRef ?? '');
  const body = { ...(code ? { code } : {}), name: input.name, uom: input.uom, item_group: input.itemGroup, ...(customerRef ? { customer_ref: customerRef } : {}) };
  const value = await mutate(session, '/v1/mobile/admin/items', body, 'item_create_failed', 'Item yaratilmadi', check);
  try { return supplierItemFromJson(value); } finally { check(); }
}
/** Original-owner opt-in for source adminMoveItemsToGroup; legacy Item Groups writes are unchanged. */
export async function moveAdminCatalogItems(session: Session, itemCodes: readonly string[], itemGroup: string, guard: Guard): Promise<AdminItemGroupBulkMoveResult> {
  const check = requiredGuard(guard); check();
  const value = await mutate(session, '/v1/mobile/admin/items/bulk-move-group', { item_codes: [...itemCodes], item_group: itemGroup },
    'item_group_bulk_move_failed', 'Mahsulotlar groupga ko‘chirilmadi', check);
  try { return adminItemGroupBulkMoveResultFromJson(value); } finally { check(); }
}
