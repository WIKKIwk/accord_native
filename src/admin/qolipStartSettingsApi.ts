import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';

const path = '/v1/mobile/admin/production-maps/qolip-start-settings';
const invalid = () => new MobileApiException({ code: 'qolip_automatic_confirmation_invalid',
  message: 'Qoliplarni avtomatik tasdiqlash ma’lumoti tasdiqlanmadi' });
/** @v2 AdminQolipStartSettings */
export type AdminQolipStartSettings = { automatic_confirmation_enabled: boolean; revision: number };
export function adminQolipStartSettingsFromJson(value: unknown): AdminQolipStartSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  if (typeof row.automatic_confirmation_enabled !== 'boolean' || !Number.isInteger(row.revision) || (row.revision as number) < 0) throw invalid();
  return { automatic_confirmation_enabled: row.automatic_confirmation_enabled, revision: row.revision as number };
}
async function settingsResponse(response: Response): Promise<AdminQolipStartSettings> {
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'qolip_start_settings');
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid();
  const row = payload as Record<string, unknown>;
  if (row.ok !== true || !row.settings || typeof row.settings !== 'object' || Array.isArray(row.settings)) throw invalid();
  return adminQolipStartSettingsFromJson(row.settings);
}
/** @v2 qolipStartSettings */
export async function qolipStartSettings(session: Session, beforeSend?: () => void): Promise<AdminQolipStartSettings> {
  return settingsResponse(await authorizedFetch(session, path, undefined, beforeSend));
}
/** @v2 setQolipAutomaticConfirmationEnabled */
export async function setQolipAutomaticConfirmationEnabled(session: Session, enabled: boolean, beforeSend?: () => void): Promise<AdminQolipStartSettings> {
  const response = await authorizedFetch(session, path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ automatic_confirmation_enabled: enabled }) }, beforeSend);
  const settings = await settingsResponse(response);
  if (settings.automatic_confirmation_enabled !== enabled) throw invalid();
  return settings;
}
