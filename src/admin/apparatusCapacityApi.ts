import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';
import { apparatusCapacityProfileFromJson, type AdminApparatusCapacitySnapshot } from './apparatusCapacityModel';

const path = '/v1/mobile/admin/production-maps/capacity';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Partial V2 live read; test mode and exact errors remain open. */
export async function adminApparatusCapacitySnapshot(session: Session, beforeSend?: () => void): Promise<AdminApparatusCapacitySnapshot> {
  let response: Response;
  try { response = await authorizedFetch(session, path, undefined, beforeSend); }
  catch (error) { beforeSend?.(); throw error; }
  beforeSend?.();
  if (response.status !== 200) {
    let value: unknown;
    try { value = await response.json(); } catch { value = null; }
    beforeSend?.();
    const error = productionMapResponseError(response.status, value, 'apparatus_capacity');
    throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode,
      diagnostics: error.diagnostics, requestId: error.requestId });
  }
  let value: unknown;
  try { value = await response.json(); } catch (error) { beforeSend?.(); throw error; }
  beforeSend?.();
  if (!object(value)) throw new TypeError('Invalid apparatus capacity response');
  if (!Array.isArray(value.capacity)) throw new MobileApiException({ code: 'apparatus_capacity_invalid_response', message: 'Aparat quvvati olinmadi' });
  return { profiles: value.capacity.filter(object).map(apparatusCapacityProfileFromJson), downtimes: [], reservations: [] };
}
