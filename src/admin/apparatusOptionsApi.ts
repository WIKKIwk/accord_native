import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { apparatusFamilyForNormalizedOperation, apparatusKindForNormalizedTechnology } from '../apparatusApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';

function canonicalStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => dartTrim(dartJsonString(item))).filter(Boolean).map(dartPartialLower);
}
function operationForTechnology(technology: string): string {
  switch (technology) {
    case 'rotogravure': case 'flexographic': return 'print';
    case 'adhesive_lamination': case 'extrusion_lamination': return 'laminate';
    case 'slitting': return 'cut';
    case 'bag_making': return 'package';
    case 'cold_glue': return 'glue';
    default: return '';
  }
}
/** @v2 AdminApparatusMasterOptions */
export type AdminApparatusMasterOptions = { families: string[]; kinds_by_family: Record<string, string[]>; capabilities: string[];
  color_stations_min: number; color_stations_max: number };
export function adminApparatusMasterOptionsFromJson(value: unknown): AdminApparatusMasterOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid apparatus options');
  const row = value as Record<string, unknown>;
  if (row.contract !== 'canonical_apparatus_revision') throw new TypeError('Unsupported apparatus options contract');
  if (!row.vocabulary || typeof row.vocabulary !== 'object' || Array.isArray(row.vocabulary)) throw new TypeError('Canonical apparatus vocabulary is missing');
  const vocab = row.vocabulary as Record<string, unknown>;
  const families = canonicalStringList(vocab.execution_operations).map(apparatusFamilyForNormalizedOperation).filter(item => item !== 'other');
  const kinds: Record<string, string[]> = {};
  for (const technology of canonicalStringList(vocab.process_technologies)) {
    const family = apparatusFamilyForNormalizedOperation(operationForTechnology(technology));
    const kind = apparatusKindForNormalizedTechnology(technology);
    if (family === 'other' || kind === 'other') continue;
    (kinds[family] ??= []).push(kind);
  }
  const min = row.color_stations_min;
  if (min != null && (typeof min !== 'number' || !Number.isFinite(min))) throw new TypeError('Invalid apparatus color station minimum');
  return { families, kinds_by_family: kinds, capabilities: canonicalStringList(vocab.equipment_capabilities),
    color_stations_min: min == null ? 1 : Math.trunc(min as number), color_stations_max: 32 };
}
/** @v2 AdminApparatusMasterOptions.kindsForFamily */
export function apparatusKindsForFamily(options: AdminApparatusMasterOptions, family: string | null): string[] {
  const key = dartPartialLower(dartTrim(family ?? ''));
  return Object.hasOwn(options.kinds_by_family, key) ? options.kinds_by_family[key] : [];
}
/** @v2 AdminApparatusMasterOptions.supportsCapability */
export function apparatusSupportsCapability(options: AdminApparatusMasterOptions, capability: string): boolean {
  return options.capabilities.includes(dartPartialLower(dartTrim(capability)));
}
/** @v2 adminApparatusMasterOptions */
export async function adminApparatusMasterOptions(session: Session): Promise<AdminApparatusMasterOptions> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/apparatus/options');
  if (response.status !== 200) throw new Error('Admin apparatus options failed');
  return adminApparatusMasterOptionsFromJson(await response.json());
}

// Reuse the existing normalized vocabulary projection in Admin create logic.
export { operationForTechnology as apparatusOperationForNormalizedTechnology };
