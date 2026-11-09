import type { AdminApparatus } from '../apparatusApi';
import type { NormalizedApparatusCreate } from './apparatusCreateModel';
import { apparatusColorStations, requiredApparatusInteger } from './apparatusCanonicalDraft';

/** Partial f119 update projection. Inputs must come from the validated create normalizer and the existing apparatus reader. */
export function canonicalApparatusUpdateDraft(input: NormalizedApparatusCreate, current: AdminApparatus) {
  const colorStations = apparatusColorStations(input.color_stations), revision = requiredApparatusInteger(current.source_revision, 'apparatus revision'),
    sortOrder = requiredApparatusInteger(current.sort_order, 'apparatus sort order'),
    minWidth = current.min_web_width_mm == null ? null : requiredApparatusInteger(current.min_web_width_mm, 'apparatus minimum width'),
    maxWidth = current.max_web_width_mm == null ? null : requiredApparatusInteger(current.max_web_width_mm, 'apparatus maximum width');
  const capabilities = input.capabilities.map(code => {
    const profile = input.capability_profiles.find(item => item.code === code) ?? current.capability_profiles.find(item => item.code === code);
    return { code, level: profile ? requiredApparatusInteger(profile.level, 'apparatus capability level') : 1 };
  });
  const patch = { display: { display_name: input.name, description: current.description, catalog_order: sortOrder },
    equipment_class_id: `equipment-class:mini-rs-erp:${input.operation}:${input.technology}`, capabilities,
    execution_profile: { operation: input.operation, technology: input.technology, color_station_count: colorStations,
      ...(minWidth == null ? {} : { min_web_width_mm: minWidth }),
      ...(maxWidth == null ? {} : { max_web_width_mm: maxWidth }),
      virtual_tasks: current.virtual_tasks, capability_compatible_reroute: current.capability_compatible_reroute },
    ...(input.factory_map_object_id_supplied && input.factory_map_object_id ?
      { placement: { factory_map_object_id: input.factory_map_object_id } } : {}),
    ...(input.training_enabled == null ? {} : { training: { enabled: input.training_enabled,
      queue_enabled: input.training_enabled && current.training_queue_enabled,
      material_tracking_enabled: input.training_enabled && current.training_material_tracking_enabled } }) };
  return { expected_revision: revision, patch };
}
