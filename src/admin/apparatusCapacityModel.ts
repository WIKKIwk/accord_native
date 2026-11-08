import { MobileApiException } from '../shared/mobileApiException';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
const requiredObject = (value: unknown): JsonObject => {
  const result = object(value);
  if (!result) throw new TypeError('Invalid apparatus capacity object');
  return result;
};
const text = (value: unknown): string => value == null ? '' : dartJsonString(value);
function integer(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid apparatus capacity number');
  return Math.trunc(value);
}
function requireApparatusId(value: unknown): string {
  const id = dartTrim(text(value));
  if (!isCanonicalApparatusId(id)) throw new MobileApiException({ code: 'apparatus_id_invalid', message: 'Canonical apparatus ID noto‘g‘ri' });
  return id;
}
function objects<T>(value: unknown, parse: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.filter(item => object(item) !== null).map(parse) : [];
}

/** Partial source-derived AdminApparatusWorkingWindow model; parity gaps are tracked in the Admin status. */
export type AdminApparatusWorkingWindow = { weekday: number; start_minute: number; end_minute: number };
export function apparatusWorkingWindowFromJson(value: unknown): AdminApparatusWorkingWindow {
  const row = requiredObject(value);
  return { weekday: integer(row.weekday, 1), start_minute: integer(row.start_minute, 0), end_minute: integer(row.end_minute, 1440) };
}
export function apparatusWorkingWindowToJson(value: AdminApparatusWorkingWindow): JsonObject {
  return { weekday: value.weekday, start_minute: value.start_minute, end_minute: value.end_minute };
}

/** Partial source-derived AdminApparatusCapacityProfile model; parity gaps are tracked in the Admin status. */
export type AdminApparatusCapacityProfile = { apparatus_id: string; apparatus: string; source_revision: number; source_aasx_sha256: string;
  capacity_slots: number; setup_minutes: number; cleanup_minutes: number; efficiency_percent: number; finite_capacity: boolean;
  working_windows: AdminApparatusWorkingWindow[]; capabilities: string[]; capability_levels: Record<string, number>; notes: string; updated_at_unix: number };
export function apparatusCapacityProfileFromJson(value: unknown): AdminApparatusCapacityProfile {
  const row = requiredObject(value), id = requireApparatusId(row.apparatus_id), name = dartTrim(text(row.apparatus)),
    revision = integer(row.source_revision, 0), hash = dartTrim(text(row.source_aasx_sha256)),
    slots = integer(row.capacity_slots, 1), setup = integer(row.setup_minutes, 0), cleanup = integer(row.cleanup_minutes, 0),
    efficiency = integer(row.efficiency_percent, 100), finite = row.finite_capacity !== false,
    windows = objects(row.working_windows, apparatusWorkingWindowFromJson);
  const capabilities = Array.isArray(row.capabilities) ? row.capabilities.map(dartJsonString).map(dartTrim).filter(Boolean).map(dartPartialLower) : [];
  const levels: Record<string, number> = Object.create(null), rawLevels = object(row.capability_levels);
  if (rawLevels) for (const [key, value] of Object.entries(rawLevels)) {
    const normalized = dartTrim(key);
    if (normalized) levels[dartPartialLower(normalized)] = integer(value, 1);
  }
  return { apparatus_id: id, apparatus: name, source_revision: revision, source_aasx_sha256: hash, capacity_slots: slots,
    setup_minutes: setup, cleanup_minutes: cleanup, efficiency_percent: efficiency, finite_capacity: finite,
    working_windows: windows, capabilities, capability_levels: levels, notes: text(row.notes), updated_at_unix: integer(row.updated_at_unix, 0) };
}
export function apparatusCapacityProfileToJson(value: AdminApparatusCapacityProfile): JsonObject {
  return { apparatus_id: dartTrim(value.apparatus_id), apparatus: dartTrim(value.apparatus), source_revision: value.source_revision,
    source_aasx_sha256: value.source_aasx_sha256, capacity_slots: value.capacity_slots, setup_minutes: value.setup_minutes,
    cleanup_minutes: value.cleanup_minutes, efficiency_percent: value.efficiency_percent, finite_capacity: value.finite_capacity,
    working_windows: value.working_windows.map(apparatusWorkingWindowToJson), capabilities: value.capabilities,
    capability_levels: value.capability_levels, notes: value.notes, updated_at_unix: value.updated_at_unix };
}
export function apparatusCanonicalCapacityToJson(value: AdminApparatusCapacityProfile): JsonObject {
  return { capacity_slots: value.capacity_slots, setup_minutes: value.setup_minutes, cleanup_minutes: value.cleanup_minutes,
    efficiency_percent: value.efficiency_percent, finite_capacity: value.finite_capacity,
    availability: value.working_windows.length ? { mode: 'scheduled', working_windows: value.working_windows.map(apparatusWorkingWindowToJson) }
      : { mode: 'always' } };
}

/** Partial source-derived AdminApparatusDowntime model; parity gaps are tracked in the Admin status. */
export type AdminApparatusDowntime = { id: string; apparatus_id: string; apparatus: string; starts_at_unix: number; ends_at_unix: number;
  reason: string; active: boolean; actor: { role: string; ref: string; display_name: string }; created_at_unix: number };
export function apparatusDowntimeFromJson(value: unknown): AdminApparatusDowntime {
  const row = requiredObject(value), actor = object(row.actor) ?? {};
  return { id: text(row.id), apparatus_id: requireApparatusId(row.apparatus_id), apparatus: text(row.apparatus),
    starts_at_unix: integer(row.starts_at_unix, 0), ends_at_unix: integer(row.ends_at_unix, 0), reason: text(row.reason),
    active: row.active !== false, actor: { role: text(actor.role), ref: text(actor.ref), display_name: text(actor.display_name) },
    created_at_unix: integer(row.created_at_unix, 0) };
}
export function apparatusDowntimeToJson(value: AdminApparatusDowntime): JsonObject {
  return { id: value.id, apparatus_id: value.apparatus_id, apparatus: value.apparatus, starts_at_unix: value.starts_at_unix,
    ends_at_unix: value.ends_at_unix, reason: value.reason, active: value.active,
    actor: { role: value.actor.role, ref: value.actor.ref, display_name: value.actor.display_name }, created_at_unix: value.created_at_unix };
}

/** Partial source-derived AdminApparatusCapabilityRequirement model; parity gaps are tracked in the Admin status. */
export type AdminApparatusCapabilityRequirement = { code: string; min_level: number };
export function apparatusCapabilityRequirementFromJson(value: unknown): AdminApparatusCapabilityRequirement {
  const row = requiredObject(value);
  return { code: dartTrim(text(row.code)), min_level: integer(row.min_level, 1) };
}
export function apparatusCapabilityRequirementToJson(value: AdminApparatusCapabilityRequirement): JsonObject {
  return { code: dartTrim(value.code), min_level: value.min_level };
}

/** Partial source-derived AdminApparatusScheduleCandidate model; parity gaps are tracked in the Admin status. */
export type AdminApparatusScheduleCandidate = { apparatus_id: string; apparatus: string };
export function apparatusScheduleCandidateFromJson(value: unknown): AdminApparatusScheduleCandidate {
  const row = requiredObject(value);
  return { apparatus_id: requireApparatusId(row.apparatus_id), apparatus: dartTrim(text(row.apparatus)) };
}
export function apparatusScheduleCandidateToJson(value: AdminApparatusScheduleCandidate): JsonObject {
  return { apparatus_id: dartTrim(value.apparatus_id), apparatus: dartTrim(value.apparatus) };
}

/** Partial source-derived AdminApparatusScheduleReservation model; parity gaps are tracked in the Admin status. */
export type AdminApparatusScheduleReservation = { reservation_id: string; idempotency_key: string; order_id: string; apparatus_id: string;
  apparatus: string; starts_at_unix: number; ends_at_unix: number; requested_duration_minutes: number; reserved_duration_minutes: number;
  status: string; priority: number; source: string; reason: string; capability_requirements: AdminApparatusCapabilityRequirement[]; created_at_unix: number };
export function apparatusScheduleReservationFromJson(value: unknown): AdminApparatusScheduleReservation {
  const row = requiredObject(value);
  return { reservation_id: text(row.reservation_id), idempotency_key: text(row.idempotency_key), order_id: text(row.order_id),
    apparatus_id: requireApparatusId(row.apparatus_id), apparatus: text(row.apparatus), starts_at_unix: integer(row.starts_at_unix, 0),
    ends_at_unix: integer(row.ends_at_unix, 0), requested_duration_minutes: integer(row.requested_duration_minutes, 0),
    reserved_duration_minutes: integer(row.reserved_duration_minutes, 0), status: row.status == null ? 'planned' : text(row.status),
    priority: integer(row.priority, 0), source: text(row.source), reason: text(row.reason),
    capability_requirements: objects(row.capability_requirements, apparatusCapabilityRequirementFromJson), created_at_unix: integer(row.created_at_unix, 0) };
}
export function apparatusScheduleReservationToJson(value: AdminApparatusScheduleReservation): JsonObject {
  return { reservation_id: value.reservation_id, idempotency_key: value.idempotency_key, order_id: value.order_id,
    apparatus_id: value.apparatus_id, apparatus: value.apparatus, starts_at_unix: value.starts_at_unix, ends_at_unix: value.ends_at_unix,
    requested_duration_minutes: value.requested_duration_minutes, reserved_duration_minutes: value.reserved_duration_minutes,
    status: value.status, priority: value.priority, source: value.source, reason: value.reason,
    capability_requirements: value.capability_requirements.map(apparatusCapabilityRequirementToJson), created_at_unix: value.created_at_unix };
}

/** Partial source-derived AdminApparatusCapacitySnapshot model; parity gaps are tracked in the Admin status. */
export type AdminApparatusCapacitySnapshot = { profiles: AdminApparatusCapacityProfile[]; downtimes: AdminApparatusDowntime[];
  reservations: AdminApparatusScheduleReservation[] };
export function apparatusCapacitySnapshotFromJson(value: unknown): AdminApparatusCapacitySnapshot {
  const row = requiredObject(value);
  return { profiles: objects(row.profiles, apparatusCapacityProfileFromJson), downtimes: objects(row.downtimes, apparatusDowntimeFromJson),
    reservations: objects(row.reservations, apparatusScheduleReservationFromJson) };
}
