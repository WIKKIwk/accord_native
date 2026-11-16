import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminApiError } from './adminApiError';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminWorkerDetailFromJson, adminWorkerDetailProfileFromJson, adminWorkerDetailSystemFromJson, adminWorkerDetailSystemPhoneFromJson, adminWorkerDetailWorkerFromJson } from './adminWorkerDetailModel';
import type { AdminUserPrincipalRole } from './adminUsersModel';
import { dartQueryComponent } from './dartUri';

/** Dart Exception string is visible inside source phone/code failure notices. */
export class AdminWorkerDetailApiException extends Error { toString(): string { return `Exception: ${this.message}`; } }
async function request<T>(session: Session, path: string, init: RequestInit | undefined, fallback: string, decode: (value: unknown) => T,
  guard?: () => void, readWitness?: () => boolean, adminError?: { code: string; message: string }): Promise<T> {
  const check = checkedAdminGuard(guard);
  if (readWitness !== undefined && (typeof readWitness !== 'function' || !check)) throw new TypeError('Scoped worker detail read requires a guard');
  check?.();
  try {
    const response = readWitness === undefined ? await authorizedFetch(session, path, init, check) : await authorizedFetch(session, path, init, check, 10_000, { readWitness }); check?.();
    if (response.status !== 200) {
      if (!adminError) throw new AdminWorkerDetailApiException(fallback);
      const error = await adminApiError(response, adminError.code, adminError.message); check?.(); throw error;
    }
    const value: unknown = await response.json(); check?.(); try { return decode(value); } finally { check?.(); }
  } catch (error) { check?.(); throw error; }
}
const idPath = (path: string, id: string) => `${path}?id=${dartQueryComponent(id)}`;
/** @v2 adminWorkerDetail */
export const adminWorkerDetail = (session: Session, id: string, guard?: () => void, witness?: () => boolean) =>
  request(session, idPath('/v1/mobile/admin/workers/detail', id), undefined, 'Admin worker detail failed', adminWorkerDetailFromJson, guard, witness);
/** @v2 adminSystemUserDetail */
export const adminWorkerDetailSystem = (session: Session, id: string, guard?: () => void, witness?: () => boolean) =>
  request(session, idPath('/v1/mobile/admin/system-users/detail', id), undefined, 'Admin system user detail failed', adminWorkerDetailSystemFromJson, guard, witness);
/** @v2 adminWorkerProfileDetail */
export const adminWorkerDetailProfile = (session: Session, id: string, guard?: () => void, witness?: () => boolean) =>
  request(session, idPath('/v1/mobile/admin/workers/profile-detail', id), undefined, 'Admin worker profile detail failed', adminWorkerDetailProfileFromJson, guard, witness);
/** @v2 adminUpdateWorkerPhone */
export const adminWorkerDetailUpdatePhone = (session: Session, id: string, phone: string, guard?: () => void) =>
  request(session, '/v1/mobile/admin/workers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, phone }) },
    'Admin worker phone update failed', adminWorkerDetailWorkerFromJson, guard, undefined, { code: 'admin_worker_phone_update_failed', message: 'Ishchi telefoni saqlanmadi' });
/** @v2 adminUpdateSystemUserPhone */
export const adminWorkerDetailUpdateSystemPhone = (session: Session, input: { id: string; role: AdminUserPrincipalRole; name: string; phone: string }, guard?: () => void) =>
  request(session, '/v1/mobile/admin/system-users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    'Admin system user phone update failed', adminWorkerDetailSystemPhoneFromJson, guard);
/** @v2 adminRegenerateWorkerCode */
export const adminWorkerDetailRegenerateCode = (session: Session, id: string, guard?: () => void) =>
  request(session, idPath('/v1/mobile/admin/workers/code/regenerate', id), { method: 'POST' }, 'Admin worker code regenerate failed', adminWorkerDetailFromJson, guard);
/** @v2 adminRegenerateSystemUserCode */
export const adminWorkerDetailRegenerateSystemCode = (session: Session, id: string, guard?: () => void) =>
  request(session, idPath('/v1/mobile/admin/system-users/code/regenerate', id), { method: 'POST' }, 'Admin system user code regenerate failed', adminWorkerDetailSystemFromJson, guard);
