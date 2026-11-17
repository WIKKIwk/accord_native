import { nativeEpochMicroseconds } from '../../modules/accord-native-clock/src/AccordNativeClockModule';
import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminApparatus, apparatusFromJson, type AdminApparatus } from '../apparatusApi';
import { MobileApiException } from '../shared/mobileApiException';
import { adminApiError } from './adminApiError';
import { adminProductionRequest } from './adminProductionRequest';
import { normalizeApparatusCreate, type ApparatusCreateInput } from './apparatusCreateModel';
import { canonicalApparatusDraft } from './apparatusCanonicalDraft';
import { canonicalApparatusUpdateDraft } from './apparatusUpdateDraft';
import { requireCapacityApparatusId } from './apparatusCapacityModel';
let mutationCounter = 0n, opaqueCounter = 0n;
/** @v2 _nextCanonicalMutationIdempotencyKey */
export function nextCanonicalMutationIdempotencyKey(operation: string) { return `mobile:canonical-apparatus:${operation}:${BigInt(nativeEpochMicroseconds()).toString(36)}-${(++mutationCounter).toString(36)}`; }
/** @v2 _nextCanonicalApparatusOpaqueKey */
export function nextCanonicalApparatusOpaqueKey() { return `${BigInt(nativeEpochMicroseconds()).toString(36)}-${(++opaqueCounter).toString(36)}`; }
const uri = (id: string) => `/v1/mobile/admin/apparatus/${encodeURIComponent(id.trim())}`;
/** @v2 adminCreateApparatus */
export async function adminCreateApparatus(session: Session, input: ApparatusCreateInput, guard: () => void): Promise<AdminApparatus> {
  guard(); const value = normalizeApparatusCreate(input, false);
  const current = value.id ? (await adminApparatus(session, { limit: 500, beforeSend: guard })).find(item => item.id === value.id) : null;
  guard(); if (value.id && !current) throw new MobileApiException({ code: 'apparatus_not_found', message: 'Aparat topilmadi' });
  const key = nextCanonicalMutationIdempotencyKey(current ? 'update' : 'create');
  const body = current ? canonicalApparatusUpdateDraft(value, current) : canonicalApparatusDraft({ name: value.name, operation: value.operation, technology: value.technology, capabilities: value.capability_profiles, capability_codes: value.capabilities, color_stations: value.color_stations, factory_map_object_id: value.factory_map_object_id, training_enabled: value.training_enabled ?? false, opaque_key: nextCanonicalApparatusOpaqueKey() });
  const response = await authorizedFetch(session, current ? uri(current.id) : '/v1/mobile/admin/apparatus', { method: current ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body) }, guard);
  if (response.status !== 200) throw await adminApiError(response, 'canonical_apparatus_save_failed', 'Canonical aparat saqlanmadi');
  return apparatusFromJson(await response.json());
}
/** @v2 adminCanonicalApparatus */
export async function adminCanonicalApparatus(session: Session, id: string, guard: () => void) {
  const response = await authorizedFetch(session, uri(id), undefined, guard);
  if (response.status !== 200) throw await adminApiError(response, 'apparatus_load_failed', 'Aparat ma’lumotlari yuklanmadi');
  return apparatusFromJson(await response.json());
}
/** @v2 adminPatchCanonicalApparatus */
export async function adminPatchCanonicalApparatus(session: Session, apparatus: AdminApparatus, patch: Record<string, unknown>, guard: () => void) {
  guard(); if (!apparatus.id.trim() || apparatus.source_revision <= 0) throw new MobileApiException({ code: 'canonical_apparatus_revision_required', message: 'Canonical aparat revisioni topilmadi' });
  const response = await authorizedFetch(session, uri(apparatus.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'idempotency-key': nextCanonicalMutationIdempotencyKey('patch') }, body: JSON.stringify({ expected_revision: apparatus.source_revision, patch }) }, guard);
  if (response.status !== 200) throw await adminApiError(response, 'canonical_apparatus_patch_failed', 'Canonical aparat yangilanmadi');
  return apparatusFromJson(await response.json());
}
/** @v2 adminTrainingApparatusModes */
export async function adminTrainingApparatusModes(session: Session, guard: () => void): Promise<Record<string, boolean>> {
  const payload = await adminProductionRequest(session, '/v1/mobile/admin/training/apparatus', undefined, 'training_apparatus_modes', guard) as { modes?: unknown };
  if (!payload.modes || typeof payload.modes !== 'object' || Array.isArray(payload.modes)) return {};
  return Object.fromEntries(Object.entries(payload.modes).map(([key, value]) => [requireCapacityApparatusId(key), value === true]));
}
/** @v2 adminSetTrainingApparatusMode */
export async function adminSetTrainingApparatusMode(session: Session, apparatus: AdminApparatus, enabled: boolean, guard: () => void) {
  const id = requireCapacityApparatusId(apparatus.id);
  await adminProductionRequest(session, '/v1/mobile/admin/training/apparatus', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apparatus: id, enabled }) }, 'training_apparatus_mode_save', guard);
}
