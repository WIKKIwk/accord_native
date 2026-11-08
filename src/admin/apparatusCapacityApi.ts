import type { Session } from '../auth';
import { MobileApiException } from '../shared/mobileApiException';
import { apparatusCanonicalCapacityToJson, apparatusCapabilityRequirementToJson, apparatusCapacityProfileFromJson, apparatusDowntimeFromJson,
  apparatusDowntimeToJson, apparatusScheduleCandidateToJson, apparatusScheduleReservationFromJson, requireCapacityApparatusId,
  type AdminApparatusCapabilityRequirement, type AdminApparatusCapacityProfile, type AdminApparatusCapacitySnapshot, type AdminApparatusDowntime,
  type AdminApparatusScheduleCandidate, type AdminApparatusScheduleReservation } from './apparatusCapacityModel';
import { adminProductionRequest, checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';

const path = '/v1/mobile/admin/production-maps/capacity';
const schedulePath = '/v1/mobile/admin/production-maps/schedule';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

/** Partial V2 live read; test mode and exact errors remain open. */
export async function adminApparatusCapacitySnapshot(session: Session, guard?: AdminRequestGuard): Promise<AdminApparatusCapacitySnapshot> {
  const check = checkedAdminGuard(guard); check?.();
  const value = await adminProductionRequest(session, path, undefined, 'apparatus_capacity', check);
  if (!object(value)) throw new TypeError('Invalid apparatus capacity response');
  if (!Array.isArray(value.capacity)) throw new MobileApiException({ code: 'apparatus_capacity_invalid_response', message: 'Aparat quvvati olinmadi' });
  return { profiles: value.capacity.filter(object).map(apparatusCapacityProfileFromJson), downtimes: [], reservations: [] };
}

/** Partial V2 live mutation; test mode and exact errors remain open. */
export async function adminSaveApparatusDowntime(session: Session, downtime: AdminApparatusDowntime, guard?: AdminRequestGuard): Promise<AdminApparatusDowntime> {
  const check = checkedAdminGuard(guard); check?.();
  requireCapacityApparatusId(downtime.apparatus_id);
  const value = await adminProductionRequest(session, `${path}/downtime`, json(apparatusDowntimeToJson(downtime)), 'apparatus_downtime', check);
  if (!object(value)) throw new TypeError('Invalid apparatus downtime response');
  if (!object(value.downtime)) throw new MobileApiException({ code: 'apparatus_downtime_invalid_response', message: 'Aparat downtime saqlanmadi' });
  return apparatusDowntimeFromJson(value.downtime);
}

/** Partial V2 live mutation; test mode and exact errors remain open. */
export async function adminCancelApparatusScheduleReservation(session: Session, reservationId: string, reason = '',
  guard?: AdminRequestGuard): Promise<AdminApparatusScheduleReservation> {
  const check = checkedAdminGuard(guard); check?.();
  const value = await adminProductionRequest(session, `${schedulePath}/cancel`, json({ reservation_id: dartTrim(reservationId), reason }),
    'apparatus_schedule_cancel', check);
  if (!object(value)) throw new TypeError('Invalid schedule cancellation response');
  if (!object(value.reservation)) throw new MobileApiException({ code: 'apparatus_schedule_invalid_response', message: 'Jadval bandi bekor qilinmadi' });
  return apparatusScheduleReservationFromJson(value.reservation);
}

/** The integrator supplies a verified generator; the V2 default is not yet available here. */
export type CapacityIdempotencyKeys = { capacity: () => string; schedule: (normalizedOrderId: string) => string };
function generatedCapacityKey(value: string): string {
  if (typeof value !== 'string' || !/^mobile:canonical-apparatus:capacity:-?[0-9a-z]+-[0-9a-z]+$/.test(value))
    throw new Error('Capacity idempotency key unavailable');
  return value;
}
function generatedScheduleKey(value: string, orderId: string): string {
  const prefix = `mobile-schedule:${orderId}:`;
  if (typeof value !== 'string' || !value.startsWith(prefix) || !/^-?[0-9]+$/.test(value.slice(prefix.length)))
    throw new Error('Schedule idempotency key unavailable');
  return value;
}

/** Partial V2 live mutation. The required key factory is an integration dependency, not a default implementation. */
export async function adminSaveApparatusCapacityProfile(session: Session, profile: AdminApparatusCapacityProfile,
  keys: Pick<CapacityIdempotencyKeys, 'capacity'>, guard?: AdminRequestGuard): Promise<AdminApparatusCapacityProfile> {
  const check = checkedAdminGuard(guard); check?.();
  requireCapacityApparatusId(profile.apparatus_id);
  const key = generatedCapacityKey(keys.capacity());
  const init: RequestInit = { method: 'PUT', headers: { 'Content-Type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ apparatus_id: dartTrim(profile.apparatus_id), expected_revision: profile.source_revision,
      capacity: apparatusCanonicalCapacityToJson(profile) }) };
  const value = await adminProductionRequest(session, path, init, 'apparatus_capacity', check);
  if (!object(value)) throw new TypeError('Invalid apparatus capacity response');
  const committed = value.revision;
  if (!object(committed) || !object(committed.revision))
    throw new MobileApiException({ code: 'apparatus_capacity_invalid_response', message: 'Aparat profili saqlanmadi' });
  const revision = committed.revision, metadata = object(revision.revision_metadata) ? revision.revision_metadata : null,
    capacity = revision.capacity;
  if (!object(capacity)) throw new MobileApiException({ code: 'apparatus_capacity_invalid_response', message: 'Aparat profili saqlanmadi' });
  const availability = object(capacity.availability) ? capacity.availability : {};
  return apparatusCapacityProfileFromJson({ apparatus_id: revision.apparatus_id, apparatus: profile.apparatus,
    source_revision: metadata ? metadata.revision : 0, source_aasx_sha256: committed.aasx_sha256,
    ...capacity, working_windows: availability.working_windows ?? [] });
}

export type AdminApparatusScheduleInput = { order_id: string; apparatus_id: string; apparatus: string; earliest_start_unix: number;
  latest_end_unix?: number | null; duration_minutes: number; priority?: number; source?: string; reason?: string; idempotency_key?: string;
  capability_requirements?: readonly AdminApparatusCapabilityRequirement[]; candidate_apparatuses?: readonly AdminApparatusScheduleCandidate[] };
/** Partial V2 live mutation. Empty keys require an independently verified key factory before integration. */
export async function adminScheduleApparatusOrder(session: Session, input: AdminApparatusScheduleInput,
  keys?: Pick<CapacityIdempotencyKeys, 'schedule'>, guard?: AdminRequestGuard): Promise<AdminApparatusScheduleReservation> {
  const check = checkedAdminGuard(guard); check?.();
  const apparatusId = requireCapacityApparatusId(input.apparatus_id), candidates = input.candidate_apparatuses ?? [];
  for (const candidate of candidates) requireCapacityApparatusId(candidate.apparatus_id);
  const orderId = dartTrim(input.order_id), explicit = dartTrim(input.idempotency_key ?? '');
  const key = explicit || (keys ? generatedScheduleKey(keys.schedule(orderId), orderId) : (() => { throw new Error('Schedule idempotency key unavailable'); })());
  const value = await adminProductionRequest(session, schedulePath, json({ order_id: orderId, apparatus_id: apparatusId, apparatus: dartTrim(input.apparatus),
    earliest_start_unix: input.earliest_start_unix, latest_end_unix: input.latest_end_unix ?? null, duration_minutes: input.duration_minutes,
    priority: input.priority ?? 0, source: input.source ?? 'admin', reason: input.reason ?? '', idempotency_key: key,
    capability_requirements: (input.capability_requirements ?? []).map(apparatusCapabilityRequirementToJson),
    candidate_apparatuses: candidates.map(apparatusScheduleCandidateToJson) }), 'apparatus_schedule', check);
  if (!object(value)) throw new TypeError('Invalid schedule response');
  if (!object(value.reservation)) throw new MobileApiException({ code: 'apparatus_schedule_invalid_response', message: 'Aparat jadvali saqlanmadi' });
  return apparatusScheduleReservationFromJson(value.reservation);
}
