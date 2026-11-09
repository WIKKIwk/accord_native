import { apparatusFromJson, type AdminApparatus } from '../apparatusApi';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { dartJsonString, dartTrim } from './dartJsonString';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as ObjectValue : null;
function string(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid factory location string');
  return value;
}
function numberToInt(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid factory location number');
  return Math.trunc(value);
}
function compactApparatus(row: ObjectValue): AdminApparatus {
  if (object(row.runtime_projection) || Object.hasOwn(row, 'apparatus_id')) return apparatusFromJson(row);
  const id = row.id == null ? '' : dartTrim(dartJsonString(row.id));
  const name = row.name == null ? '' : dartTrim(dartJsonString(row.name));
  const sourceRevision = numberToInt(row.source_revision);
  if (!isCanonicalApparatusId(id) || !name || sourceRevision < 1) throw new TypeError('Invalid factory location apparatus snapshot');
  return { id, name, source: 'canonical', sort_order: 10000, family: 'other', kind: 'other', capabilities: [],
    capability_profiles: [], color_stations: null, factory_map_object_id: '', training_enabled: false,
    source_revision: sourceRevision, source_aasx_sha256: '', description: '',
    equipment_class_id: row.equipment_class_id == null ? '' : dartTrim(dartJsonString(row.equipment_class_id)),
    physical_asset_id: row.physical_asset_id == null ? '' : dartTrim(dartJsonString(row.physical_asset_id)),
    enterprise_id: '', site_id: '', area_id: '', work_center_id: '', work_unit_id: '', operation: '', technology: '',
    min_web_width_mm: null, max_web_width_mm: null, virtual_tasks: 'disabled', capability_compatible_reroute: false,
    training_queue_enabled: false, training_material_tracking_enabled: false,
    lifecycle_state: row.active === false ? 'retired' : 'active', worker_material_assignment_allowed: false };
}

/** @v2 AdminFactoryLocation */
export type AdminFactoryLocation = { id: string; name: string; active: boolean; apparatus: AdminApparatus[];
  created_at_unix: number; updated_at_unix: number };
export function adminFactoryLocationFromJson(value: unknown): AdminFactoryLocation {
  const row = object(value);
  if (!row) throw new TypeError('Invalid factory location');
  const id = string(row.id), name = string(row.name), active = row.active !== false;
  const rawApparatus = row.apparatus ?? [];
  if (!Array.isArray(rawApparatus)) throw new TypeError('Invalid factory location apparatus list');
  return { id, name, active,
    apparatus: rawApparatus.map(object).filter((item): item is ObjectValue => item !== null).map(compactApparatus),
    created_at_unix: numberToInt(row.created_at_unix), updated_at_unix: numberToInt(row.updated_at_unix) };
}
export function isApparatusState(location: AdminFactoryLocation): boolean { return location.apparatus.length > 0; }
