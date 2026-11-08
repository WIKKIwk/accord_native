import { apparatusFamilyForNormalizedOperation, apparatusKindForNormalizedTechnology, type ApparatusCapabilityProfile } from '../apparatusApi';
import { apparatusOperationForNormalizedTechnology } from './apparatusOptionsApi';
import { dartPartialLower, dartTrim } from './dartJsonString';

const operations = ['print', 'laminate', 'cut', 'package', 'glue'] as const;
const technologies = ['rotogravure', 'flexographic', 'adhesive_lamination', 'extrusion_lamination', 'slitting', 'bag_making', 'cold_glue'] as const;
const normalized = (value: string): string => dartPartialLower(dartTrim(value));
/** Partial f119 source mapping; full Dart Unicode lowercasing remains an open dependency. */
export function canonicalOperationForFamily(family: string): string {
  const key = normalized(family);
  return operations.find(operation => apparatusFamilyForNormalizedOperation(operation) === key) ?? '';
}
export function canonicalTechnologyForKind(kind: string): string {
  const key = normalized(kind);
  return technologies.find(technology => apparatusKindForNormalizedTechnology(technology) === key) ?? '';
}
export function canonicalOperationForTechnology(technology: string): string {
  return apparatusOperationForNormalizedTechnology(normalized(technology));
}
export type CanonicalApparatusDraftInput = { name: string; operation: string; technology: string;
  capabilities: readonly Pick<ApparatusCapabilityProfile, 'code' | 'level'>[]; capability_codes: readonly string[];
  color_stations: number | null; factory_map_object_id: string; training_enabled: boolean; opaque_key: string };
/** Pure source-derived request projection; validation, key generation and actual mutation remain separate. */
export function canonicalApparatusDraft(input: CanonicalApparatusDraftInput) {
  const levels = new Map(input.capabilities.map(profile => [profile.code, profile.level]));
  const codes = [...new Set([...input.capability_codes, input.operation, ...(input.training_enabled ? ['training'] : [])])].sort();
  return { display: { display_name: input.name, description: '', catalog_order: 10000 },
    equipment_class_id: `equipment-class:mini-rs-erp:${input.operation}:${input.technology}`,
    physical_asset_id: `physical-asset:mobile:${input.opaque_key}`,
    hierarchy: { enterprise_id: 'enterprise:accord', site_id: 'site:main', area_id: 'area:production',
      work_center_id: `work-center:${input.operation}`, work_unit_id: `work-unit:mobile:${input.opaque_key}` },
    capabilities: codes.map(code => ({ code, level: levels.get(code) ?? 1 })),
    execution_profile: { operation: input.operation, technology: input.technology, color_station_count: input.color_stations,
      virtual_tasks: 'disabled', capability_compatible_reroute: true },
    policies: { queue: 'strict_sequence', material: { mode: 'not_required' }, tooling: { mode: 'not_required' } },
    capacity: { capacity_slots: 1, setup_minutes: 0, cleanup_minutes: 0, efficiency_percent: 100, finite_capacity: true,
      availability: { mode: 'always' } },
    placement: input.factory_map_object_id ? { factory_map_object_id: input.factory_map_object_id } : null,
    training: { enabled: input.training_enabled, queue_enabled: input.training_enabled, material_tracking_enabled: input.training_enabled },
    lifecycle: { state: 'active', retirement_reason: null } };
}
