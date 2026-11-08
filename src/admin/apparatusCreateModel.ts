import type { ApparatusCapabilityProfile } from '../apparatusApi';
import { MobileApiException } from '../shared/mobileApiException';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { canonicalOperationForFamily, canonicalOperationForTechnology, canonicalTechnologyForKind } from './apparatusCanonicalDraft';
import { dartPartialLower, dartTrim } from './dartJsonString';

const allowed = new Set(['print', 'laminate', 'cut', 'package', 'glue', 'tooling', 'virtual_task', 'training']);
const normalize = (value: string): string => dartPartialLower(dartTrim(value));
export type ApparatusCreateInput = { name: string; id?: string; family?: string; kind?: string; capabilities?: Iterable<string>;
  capability_profiles?: Iterable<ApparatusCapabilityProfile>; color_stations?: number | null; factory_map_object_id?: string | null;
  training_enabled?: boolean | null };
export type NormalizedApparatusCreate = { name: string; id: string; family: string; kind: string; operation: string; technology: string;
  capabilities: string[]; capability_profiles: ApparatusCapabilityProfile[]; color_stations: number | null;
  factory_map_object_id: string; factory_map_object_id_supplied: boolean; training_enabled: boolean | null };
/** Pure f119 validation/normalization only; test-mode persistence, API, keys and Unicode parity remain open. */
export function normalizeApparatusCreate(input: ApparatusCreateInput, testMode: boolean): NormalizedApparatusCreate {
  const name = dartTrim(input.name);
  if (!name) throw new MobileApiException({ code: 'apparatus_display_name_required', message: 'Aparat nomi kiritilmadi' });
  const id = dartTrim(input.id ?? '');
  if (id && !isCanonicalApparatusId(id)) throw new MobileApiException({ code: 'apparatus_id_invalid', message: 'Canonical apparatus ID noto‘g‘ri' });
  const family = normalize(input.family ?? ''), kind = normalize(input.kind ?? ''), mapId = dartTrim(input.factory_map_object_id ?? '');
  let operation = canonicalOperationForFamily(family), technology = canonicalTechnologyForKind(kind);
  if (testMode && !operation && !technology) { operation = 'package'; technology = 'bag_making'; }
  if (!operation || !technology || canonicalOperationForTechnology(technology) !== operation)
    throw new MobileApiException({ code: 'canonical_execution_profile_required', message: 'Aparat turi va texnologiyasi canonical contractga mos emas' });
  const profiles: ApparatusCapabilityProfile[] = [];
  for (const profile of input.capability_profiles ?? []) {
    const code = normalize(profile.code);
    if (!Number.isInteger(profile.level)) throw new TypeError('Invalid apparatus capability level');
    const level = Math.max(1, Math.min(100, profile.level));
    if (profile.enabled && allowed.has(code)) profiles.push({ code, level, valid_from_unix: profile.valid_from_unix,
      valid_to_unix: profile.valid_to_unix, enabled: profile.enabled });
  }
  const capabilities = new Set<string>();
  for (const value of input.capabilities ?? []) { const code = normalize(value); if (allowed.has(code)) capabilities.add(code); }
  for (const profile of profiles) capabilities.add(profile.code);
  capabilities.add(operation);
  if (input.training_enabled === true) capabilities.add('training');
  return { name, id, family, kind, operation, technology, capabilities: [...capabilities].sort(), capability_profiles: profiles,
    color_stations: input.color_stations ?? null, factory_map_object_id: mapId,
    factory_map_object_id_supplied: input.factory_map_object_id != null, training_enabled: input.training_enabled ?? null };
}
