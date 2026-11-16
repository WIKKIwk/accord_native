import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminWarehouseFromJson, type GScaleAdminWarehouse } from '../gscale/gscaleAdminApi';
import { preparationResponsibilityFromJson } from '../preparationReadApi';
import { MobileApiException } from '../shared/mobileApiException';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminWorkerDetailObject, adminWorkerDetailWarehouseNames, adminWorkerDetailWarehouseRole } from './adminWorkerDetailModel';
import { AdminWorkerDetailApiException } from './adminWorkerDetailApi';
import type { AdminUserListEntry } from './adminUsersModel';
import { adminWarehouseSettingsAssignments } from './adminWarehouseSettingsApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';

export type AdminWorkerDetailResponsibility = ReturnType<typeof preparationResponsibilityFromJson>;
export type AdminWorkerDetailMaterial = Readonly<{ id: string; name: string; active: boolean; density_g_cm3: number;
  variants: readonly Readonly<{ micron: number; coefficient: number; first_layer_coefficient: number | null; actual_gsm: number | null }>[] }>;
function responsibility(value: unknown): AdminWorkerDetailResponsibility {
  const item = preparationResponsibilityFromJson(value); return Object.freeze({ ...item, material_id: dartTrim(item.material_id), material_name: dartTrim(item.material_name) });
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => value == null ? '' : dartTrim(dartJsonString(value));
function number(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  const string = text(value);
  return /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(string) ? Number(string) : fallback;
}
const optionalNumber = (value: unknown): number | null => !text(value) ? null : typeof value === 'number' ? value :
  /^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(text(value)) ? Number(text(value)) : null;
function int(value: unknown): number {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('Invalid calculate integer'); return Math.trunc(value); }
  const string = text(value); if (!/^[+-]?(?:\d+|0[xX][0-9a-fA-F]+)$/.test(string)) return 0;
  const sign = string.startsWith('-') ? -1 : 1; return sign * Number(string.replace(/^[+-]/, ''));
}
/** @v2 CalculateMaterial */
export function adminWorkerDetailMaterialFromJson(value: unknown): AdminWorkerDetailMaterial {
  const row = adminWorkerDetailObject(value), variants = row.variants ?? [];
  if (!Array.isArray(variants)) throw new TypeError('Invalid calculate variants');
  return Object.freeze({ id: text(row.id), name: text(row.name), active: row.active !== false, density_g_cm3: number(row.density_g_cm3),
    variants: Object.freeze(variants.filter(object).map(item => Object.freeze({ micron: int(item.micron), coefficient: number(item.coefficient),
      first_layer_coefficient: optionalNumber(item.first_layer_coefficient), actual_gsm: optionalNumber(item.actual_gsm) })).filter(item => item.micron > 0)) });
}
async function transport(session: Session, path: string, init: RequestInit | undefined, guard?: () => void, witness?: () => boolean) {
  const check = checkedAdminGuard(guard);
  if (witness !== undefined && (typeof witness !== 'function' || !check)) throw new TypeError('Scoped worker assignment read requires a guard');
  check?.();
  try {
    const response = witness === undefined ? await authorizedFetch(session, path, init, check) : await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness }); check?.();
    return { response, check };
  } catch (error) { check?.(); throw error; }
}
async function body(response: Response, check?: () => void): Promise<unknown> {
  try { const value: unknown = await response.json(); check?.(); return value; } catch (error) { check?.(); throw error; }
}
/** @v2 adminWarehouses
 * Admin-owned guarded adapter retains the existing warehouse parser and leaves GScale callers untouched. */
export async function adminWorkerDetailWarehouses(session: Session, guard?: () => void, witness?: () => boolean): Promise<readonly GScaleAdminWarehouse[]> {
  const { response, check } = await transport(session, '/v1/mobile/admin/warehouses?limit=500', undefined, guard, witness);
  if (response.status !== 200) throw new AdminWorkerDetailApiException('Admin warehouses failed');
  const value = await body(response, check);
  try { if (!Array.isArray(value)) throw new TypeError('Invalid warehouses'); return Object.freeze(value.map(adminWarehouseFromJson)); } finally { check?.(); }
}
/** @v2 _loadAssignedWarehouses */
export async function adminWorkerDetailAssignedWarehouses(session: Session, entry: AdminUserListEntry, guard?: () => void, witness?: () => boolean): Promise<readonly string[]> {
  const check = checkedAdminGuard(guard); check?.();
  const rows = await adminWarehouseSettingsAssignments(session, '', check, witness); check?.();
  const ref = dartPartialLower(dartTrim(entry.id)), role = adminWorkerDetailWarehouseRole(entry);
  const result = adminWorkerDetailWarehouseNames(rows.filter(row => row.principal_role === role && dartPartialLower(dartTrim(row.principal_ref)) === ref).map(row => row.warehouse)); check?.(); return result;
}
async function preparation(session: Session, path: string, init: RequestInit | undefined, guard?: () => void, witness?: () => boolean) {
  const { response, check } = await transport(session, path, init, guard, witness);
  let value: unknown; try { value = await body(response, check); } catch { check?.(); value = null; }
  check?.();
  if (response.status !== 200 || !object(value)) {
    const raw = object(value) ? value.error : null;
    if (raw != null && typeof raw !== 'string') throw new TypeError('Invalid preparation error');
    throw new MobileApiException({ code: 'preparation_request_failed', statusCode: response.status,
      message: raw ?? 'Tayyorlov ma’lumotlari olinmadi. Qayta urinib ko‘ring' });
  }
  return { data: value, check };
}
/** @v2 preparationResponsibilities */
export async function adminWorkerDetailResponsibilities(session: Session, principalRef: string, guard?: () => void, witness?: () => boolean): Promise<readonly AdminWorkerDetailResponsibility[]> {
  const check = checkedAdminGuard(guard); check?.(); const ref = dartTrim(principalRef);
  if (!ref) throw new MobileApiException({ code: 'preparation_invalid', message: 'Foydalanuvchi topilmadi' });
  const { data } = await preparation(session, `/v1/mobile/admin/preparation/responsibilities?principal_ref=${dartQueryComponent(ref)}`, undefined, check, witness);
  try { return Object.freeze(Array.isArray(data.materials) ? data.materials.filter(object).map(responsibility) : []); } finally { check?.(); }
}
/** @v2 preparationAssignResponsibility */
export async function adminWorkerDetailAssignResponsibility(session: Session, principalRef: string, materialId: string, guard?: () => void): Promise<AdminWorkerDetailResponsibility> {
  const check = checkedAdminGuard(guard); check?.();
  const { data } = await preparation(session, '/v1/mobile/admin/preparation/responsibilities', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ principal_ref: dartTrim(principalRef), material_id: dartTrim(materialId) }) }, check);
  try { return responsibility({ material_id: data.material_id, material_name: data.material_name }); } finally { check?.(); }
}
/** @v2 preparationUnassignResponsibility */
export async function adminWorkerDetailUnassignResponsibility(session: Session, principalRef: string, materialId: string, guard?: () => void): Promise<void> {
  const check = checkedAdminGuard(guard); check?.();
  await preparation(session, `/v1/mobile/admin/preparation/responsibilities?principal_ref=${dartQueryComponent(dartTrim(principalRef))}&material_id=${dartQueryComponent(dartTrim(materialId))}`, { method: 'DELETE' }, check); check?.();
}
/** @v2 calculateMaterials */
export async function adminWorkerDetailMaterials(session: Session, guard?: () => void, witness?: () => boolean): Promise<readonly AdminWorkerDetailMaterial[]> {
  const { response, check } = await transport(session, '/v1/mobile/admin/calculate-materials', undefined, guard, witness);
  const row = adminWorkerDetailObject(await body(response, check)); check?.();
  if (response.status !== 200) throw new MobileApiException({ code: text(row.error) || 'calculate_materials', message: text(row.detail) || text(row.error) || 'Calculate materials failed', statusCode: response.status });
  const result: AdminWorkerDetailMaterial[] = [];
  if (Array.isArray(row.materials)) for (const item of row.materials) { if (!object(item)) continue; try { result.push(adminWorkerDetailMaterialFromJson(item)); } catch { /* V2 skips malformed catalog entries. */ } }
  check?.(); return Object.freeze(result);
}
