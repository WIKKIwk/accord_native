import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { productionMapResponseError } from '../workerControlsApi';
import { apparatusCapacityProfileFromJson, apparatusDowntimeFromJson, apparatusDowntimeToJson, apparatusScheduleReservationFromJson,
  requireCapacityApparatusId, type AdminApparatusCapacitySnapshot, type AdminApparatusDowntime, type AdminApparatusScheduleReservation } from './apparatusCapacityModel';
import { dartTrim } from './dartJsonString';

const path = '/v1/mobile/admin/production-maps/capacity';
const schedulePath = '/v1/mobile/admin/production-maps/schedule';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
type Guard = () => void;
async function capacityRequest(session: Session, url: string, init: RequestInit | undefined, fallback: string, guard?: Guard): Promise<unknown> {
  let response: Response;
  try { response = await authorizedFetch(session, url, init, guard); }
  catch (error) { guard?.(); throw error; }
  guard?.();
  let value: unknown;
  try { value = await response.json(); }
  catch (error) { guard?.(); if (response.status === 200) throw error; value = null; }
  guard?.();
  if (response.status !== 200) {
    const error = productionMapResponseError(response.status, value, fallback);
    throw new MobileApiException({ code: error.code, message: error.message, statusCode: error.statusCode,
      diagnostics: error.diagnostics, requestId: error.requestId });
  }
  return value;
}
const json = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

/** Partial V2 live read; test mode and exact errors remain open. */
export async function adminApparatusCapacitySnapshot(session: Session, guard?: Guard): Promise<AdminApparatusCapacitySnapshot> {
  const value = await capacityRequest(session, path, undefined, 'apparatus_capacity', guard);
  if (!object(value)) throw new TypeError('Invalid apparatus capacity response');
  if (!Array.isArray(value.capacity)) throw new MobileApiException({ code: 'apparatus_capacity_invalid_response', message: 'Aparat quvvati olinmadi' });
  return { profiles: value.capacity.filter(object).map(apparatusCapacityProfileFromJson), downtimes: [], reservations: [] };
}

/** Partial V2 live mutation; test mode and exact errors remain open. */
export async function adminSaveApparatusDowntime(session: Session, downtime: AdminApparatusDowntime, guard?: Guard): Promise<AdminApparatusDowntime> {
  requireCapacityApparatusId(downtime.apparatus_id);
  const value = await capacityRequest(session, `${path}/downtime`, json(apparatusDowntimeToJson(downtime)), 'apparatus_downtime', guard);
  if (!object(value)) throw new TypeError('Invalid apparatus downtime response');
  if (!object(value.downtime)) throw new MobileApiException({ code: 'apparatus_downtime_invalid_response', message: 'Aparat downtime saqlanmadi' });
  return apparatusDowntimeFromJson(value.downtime);
}

/** Partial V2 live mutation; test mode and exact errors remain open. */
export async function adminCancelApparatusScheduleReservation(session: Session, reservationId: string, reason = '',
  guard?: Guard): Promise<AdminApparatusScheduleReservation> {
  const value = await capacityRequest(session, `${schedulePath}/cancel`, json({ reservation_id: dartTrim(reservationId), reason }),
    'apparatus_schedule_cancel', guard);
  if (!object(value)) throw new TypeError('Invalid schedule cancellation response');
  if (!object(value.reservation)) throw new MobileApiException({ code: 'apparatus_schedule_invalid_response', message: 'Jadval bandi bekor qilinmadi' });
  return apparatusScheduleReservationFromJson(value.reservation);
}
