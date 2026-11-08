import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid admin settings');
  return value as ObjectValue;
}
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid admin settings string');
  return value;
}
function bool(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'boolean') throw new TypeError('Invalid admin settings boolean');
  return value;
}
function integer(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('Invalid admin settings integer');
  return value;
}
/** @v2 AdminSettings */
export type AdminSettings = { erp_url: string; erp_api_key: string; erp_api_secret: string; default_target_warehouse: string;
  default_uom: string; werka_phone: string; werka_name: string; werka_avatar_url: string; werka_code: string;
  werka_code_locked: boolean; werka_code_retry_after_sec: number; admin_phone: string; admin_name: string };
export function adminSettingsFromJson(value: unknown): AdminSettings {
  const row = object(value);
  return { erp_url: text(row.erp_url), erp_api_key: text(row.erp_api_key), erp_api_secret: text(row.erp_api_secret),
    default_target_warehouse: text(row.default_target_warehouse), default_uom: text(row.default_uom),
    werka_phone: text(row.werka_phone), werka_name: text(row.werka_name), werka_avatar_url: text(row.werka_avatar_url),
    werka_code: text(row.werka_code), werka_code_locked: bool(row.werka_code_locked),
    werka_code_retry_after_sec: integer(row.werka_code_retry_after_sec), admin_phone: text(row.admin_phone), admin_name: text(row.admin_name) };
}
export function adminSettingsToJson(settings: AdminSettings): AdminSettings {
  return { erp_url: settings.erp_url, erp_api_key: settings.erp_api_key, erp_api_secret: settings.erp_api_secret,
    default_target_warehouse: settings.default_target_warehouse, default_uom: settings.default_uom, werka_phone: settings.werka_phone,
    werka_name: settings.werka_name, werka_avatar_url: settings.werka_avatar_url, werka_code: settings.werka_code,
    werka_code_locked: settings.werka_code_locked, werka_code_retry_after_sec: settings.werka_code_retry_after_sec,
    admin_phone: settings.admin_phone, admin_name: settings.admin_name };
}
/** @v2 adminSettings */
export async function adminSettings(session: Session): Promise<AdminSettings> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/settings');
  if (response.status !== 200) throw new Error('Admin settings failed');
  return adminSettingsFromJson(await response.json());
}
/** @v2 updateAdminSettings */
export async function updateAdminSettings(session: Session, settings: AdminSettings): Promise<AdminSettings> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adminSettingsToJson(settings)),
  });
  if (response.status !== 200) throw new Error('Admin settings update failed');
  return adminSettingsFromJson(await response.json());
}
