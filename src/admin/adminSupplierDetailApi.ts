import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminSupplierDetailFromJson } from './adminSupplierDetailModel';
import { dartQueryComponent } from './dartUri';

/** Source plain Exception text is interpolated by the phone-failure snackbar. */
export class AdminSupplierDetailApiException extends Error { toString(): string { return `Exception: ${this.message}`; } }
async function request(session: Session, path: string, init: RequestInit | undefined, failure: string,
  guard?: () => void, witness?: () => boolean, empty = false) {
  const check = checkedAdminGuard(guard);
  if (witness !== undefined && (typeof witness !== 'function' || !check)) throw new TypeError('Scoped supplier detail read requires guard and witness');
  check?.();
  try {
    const response = witness === undefined ? await authorizedFetch(session, path, init, check) : await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness });
    check?.(); if (response.status !== 200) throw new AdminSupplierDetailApiException(failure);
    if (empty) return undefined;
    const value: unknown = await response.json(); check?.();
    try { return adminSupplierDetailFromJson(value); } finally { check?.(); }
  } catch (error) { check?.(); throw error; }
}
const refPath = (path: string, ref: string) => `${path}?ref=${dartQueryComponent(ref)}`;
const json = (value: unknown): RequestInit => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
/** @v2 adminSupplierDetail */
export const adminSupplierDetail = async (session: Session, ref: string, guard?: () => void, witness?: () => boolean) =>
  (await request(session, refPath('/v1/mobile/admin/suppliers/detail', ref), undefined, 'Admin supplier detail failed', guard, witness))!;
/** @v2 adminSetSupplierBlocked */
export const adminSetSupplierBlocked = async (session: Session, ref: string, blocked: boolean, guard?: () => void) =>
  (await request(session, refPath('/v1/mobile/admin/suppliers/status', ref), json({ blocked }), 'Admin supplier status failed', guard))!;
/** @v2 adminUpdateSupplierPhone */
export const adminUpdateSupplierPhone = async (session: Session, ref: string, phone: string, guard?: () => void) =>
  (await request(session, refPath('/v1/mobile/admin/suppliers/phone', ref), json({ phone }), 'Admin supplier phone update failed', guard))!;
/** @v2 adminRegenerateSupplierCode */
export const adminRegenerateSupplierCode = async (session: Session, ref: string, guard?: () => void) =>
  (await request(session, refPath('/v1/mobile/admin/suppliers/code/regenerate', ref), { method: 'POST' }, 'Admin supplier code regenerate failed', guard))!;
/** @v2 adminRemoveSupplier */
export async function adminRemoveSupplier(session: Session, ref: string, guard?: () => void): Promise<void> {
  await request(session, refPath('/v1/mobile/admin/suppliers/remove', ref), { method: 'DELETE' }, 'Admin supplier remove failed', guard, undefined, true);
}
/** @v2 adminRestoreSupplier */
export const adminRestoreSupplier = async (session: Session, ref: string, guard?: () => void) =>
  (await request(session, refPath('/v1/mobile/admin/suppliers/restore', ref), { method: 'POST' }, 'Admin supplier restore failed', guard))!;
