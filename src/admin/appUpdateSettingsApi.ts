import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';

const path = '/v1/mobile/admin/app-update/settings';
async function mandatoryUpdatesResponse(response: Response): Promise<boolean> {
  if (response.status === 200) {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const row = payload as Record<string, unknown>, settings = row.settings;
      if (row.ok === true && settings && typeof settings === 'object' && !Array.isArray(settings)) {
        const enabled = (settings as Record<string, unknown>).mandatory_updates_enabled;
        if (typeof enabled === 'boolean') return enabled;
      }
    }
  }
  throw new MobileApiException({ code: 'app_update_settings_failed', message: 'Yangilash sozlamasi yuklanmadi', statusCode: response.status });
}
/** @v2 mandatoryAppUpdatesEnabled */
export async function mandatoryAppUpdatesEnabled(session: Session): Promise<boolean> {
  return mandatoryUpdatesResponse(await authorizedFetch(session, path));
}
/** @v2 setMandatoryAppUpdatesEnabled */
export async function setMandatoryAppUpdatesEnabled(session: Session, enabled: boolean): Promise<boolean> {
  const response = await authorizedFetch(session, path, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mandatory_updates_enabled: enabled }) });
  const saved = await mandatoryUpdatesResponse(response);
  if (saved !== enabled) throw new MobileApiException({ code: 'app_update_settings_failed', message: 'Yangilash sozlamasi saqlanmadi' });
  return saved;
}
