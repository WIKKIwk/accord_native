import { progressBatchFromJson } from './workerProgressBatch';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value);
const integer = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite integer');
  return Math.trunc(value);
};
const weight = (value: unknown): number | null => {
  const result = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(result) && result >= 0 ? result : null;
};

/** @v2 AdminPaddon */
export function paddonFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid paddon');
  return { id: text(row.id), code: text(row.code), location: text(row.location), note: text(row.note),
    created_by_ref: text(row.created_by_ref), created_by_display_name: text(row.created_by_display_name),
    created_at_unix: integer(row.created_at_unix) ?? 0, updated_at_unix: integer(row.updated_at_unix) ?? 0,
    item_count: integer(row.item_count) ?? 0, apparatus_id: text(row.apparatus_id), total_gross_kg: weight(row.total_gross_kg),
    total_net_kg: weight(row.total_net_kg), locked_at_unix: integer(row.locked_at_unix), contains_peremotka: row.contains_peremotka === true };
}
export const paddonIsLocked = (paddon: ReturnType<typeof paddonFromJson>): boolean => paddon.locked_at_unix != null;

/** @v2 AdminPaddonSnapshot */
export function paddonSnapshotFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid paddon snapshot');
  if (row.can_manage_items != null && typeof row.can_manage_items !== 'boolean') throw new TypeError('Invalid paddon management flag');
  const items = Array.isArray(row.items) ? row.items.filter(item => object(item)).map(item => progressBatchFromJson(item)) : [];
  const assigned = new Set(items.map(item => item.batch_id.trim()).filter(Boolean));
  const available = Array.isArray(row.available_items) ? row.available_items.filter(item => object(item))
    .map(item => progressBatchFromJson(item)).filter(item => !assigned.has(item.batch_id.trim())) : [];
  const paddon = paddonFromJson(object(row.paddon) ?? {});
  return { paddon, items, available_items: available, free_movement_enabled: row.free_movement_enabled === true,
    can_unlock: row.can_unlock === true, can_manage_items: !paddonIsLocked(paddon) && (row.can_manage_items ?? true) };
}
