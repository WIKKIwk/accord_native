import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';
import { laminationLabelSettingsFromJson } from '../workerLaminationRemainders';

type Obj = Record<string, unknown>;
function object(value: unknown): Obj | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
}
async function responsePayload(response: Response, fallback: string): Promise<unknown> {
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, fallback);
  }
  return response.json();
}
const paddonPath = '/v1/mobile/admin/production-maps/paddons/management-settings';
/** @v2 PaddonManagementSettings */
export type PaddonManagementSettings = { free_movement_enabled: boolean; worker_visibility_enabled: boolean };
async function paddonResponse(response: Response): Promise<PaddonManagementSettings> {
  const payload = object(await responsePayload(response, 'paddon_management_settings'));
  const settings = object(payload?.settings);
  if (payload?.ok !== true || !settings || typeof settings.free_movement_enabled !== 'boolean' ||
    (settings.worker_visibility_enabled != null && typeof settings.worker_visibility_enabled !== 'boolean')) {
    throw new MobileApiException({ code: 'paddon_management_settings', message: 'Paddon sozlamalari tasdiqlanmadi' });
  }
  return { free_movement_enabled: settings.free_movement_enabled, worker_visibility_enabled: settings.worker_visibility_enabled === true };
}
/** @v2 paddonManagementSettings */
export async function paddonManagementSettings(session: Session, beforeSend?: () => void): Promise<PaddonManagementSettings> {
  return paddonResponse(await authorizedFetch(session, paddonPath, undefined, beforeSend));
}
/** @v2 updatePaddonManagementSettings */
export async function updatePaddonManagementSettings(session: Session,
  options: { freeMovementEnabled?: boolean | null; workerVisibilityEnabled?: boolean | null } = {}, beforeSend?: () => void): Promise<PaddonManagementSettings> {
  const { freeMovementEnabled, workerVisibilityEnabled } = options;
  const body = { ...(freeMovementEnabled != null ? { free_movement_enabled: freeMovementEnabled } : {}),
    ...(workerVisibilityEnabled != null ? { worker_visibility_enabled: workerVisibilityEnabled } : {}) };
  const response = await authorizedFetch(session, paddonPath, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) }, beforeSend);
  const settings = await paddonResponse(response);
  if ((freeMovementEnabled != null && settings.free_movement_enabled !== freeMovementEnabled) ||
    (workerVisibilityEnabled != null && settings.worker_visibility_enabled !== workerVisibilityEnabled)) {
    throw new MobileApiException({ code: 'paddon_management_settings', message: 'Paddon sozlamalari tasdiqlanmadi' });
  }
  return settings;
}
/** @v2 paddonFreeMovementEnabled */
export async function paddonFreeMovementEnabled(session: Session): Promise<boolean> {
  return (await paddonManagementSettings(session)).free_movement_enabled;
}
/** @v2 setPaddonFreeMovementEnabled */
export async function setPaddonFreeMovementEnabled(session: Session, enabled: boolean): Promise<boolean> {
  return (await updatePaddonManagementSettings(session, { freeMovementEnabled: enabled })).free_movement_enabled;
}
const laminationPath = '/v1/mobile/admin/production-maps/lamination-settings';
export type AdminLaminationLabelSettings = ReturnType<typeof laminationLabelSettingsFromJson>;
async function laminationResponse(response: Response): Promise<AdminLaminationLabelSettings> {
  const payload = object(await responsePayload(response, 'lamination_settings')), settings = object(payload?.settings);
  if (payload?.ok !== true || !settings || typeof settings.print_wip_remainder_labels !== 'boolean' ||
      typeof settings.print_film_remainder_labels !== 'boolean') {
    throw new MobileApiException({ code: 'lamination_label_backend_required', message: 'Laminatsiya label sozlamalari uchun serverni yangilang' });
  }
  return laminationLabelSettingsFromJson(settings);
}
/** @v2 laminationLabelSettings */
export async function laminationLabelSettings(session: Session, beforeSend?: () => void): Promise<AdminLaminationLabelSettings> {
  return laminationResponse(await authorizedFetch(session, laminationPath, undefined, beforeSend));
}
/** @v2 setLaminationLabelSettings */
export async function setLaminationLabelSettings(session: Session,
  options: { printWipRemainderLabels?: boolean | null; printFilmRemainderLabels?: boolean | null }, beforeSend?: () => void): Promise<AdminLaminationLabelSettings> {
  const { printWipRemainderLabels, printFilmRemainderLabels } = options;
  if (printWipRemainderLabels == null && printFilmRemainderLabels == null) throw new TypeError('A label switch is required');
  const body = { ...(printWipRemainderLabels != null ? { print_wip_remainder_labels: printWipRemainderLabels } : {}),
    ...(printFilmRemainderLabels != null ? { print_film_remainder_labels: printFilmRemainderLabels } : {}) };
  const response = await authorizedFetch(session, laminationPath, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) }, beforeSend);
  const settings = await laminationResponse(response);
  if ((printWipRemainderLabels != null && settings.print_wip_remainder_labels !== printWipRemainderLabels) ||
      (printFilmRemainderLabels != null && settings.print_film_remainder_labels !== printFilmRemainderLabels)) {
    throw new MobileApiException({ code: 'lamination_settings', message: 'Laminatsiya sozlamasi tasdiqlanmadi' });
  }
  return settings;
}
