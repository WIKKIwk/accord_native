import { jsonObject } from './preparationModel';
type ObjectValue = Record<string, unknown>;
const text = (row: ObjectValue, key: string): string => row[key] == null ? '' : String(row[key]);
function identity(row: ObjectValue, key: string) {
  const value = text(row, key).trim();
  if (!value) throw new Error('Ishlab chiqarish ma’lumoti noto‘g‘ri');
  return value;
}
function count(row: ObjectValue, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('Ishlab chiqarish miqdori noto‘g‘ri');
  return value;
}
function amount(row: ObjectValue, key: string): string {
  const value = text(row, key);
  if (!/^\d+(\.\d{1,6})?$/.test(value)) throw new Error('Ishlab chiqarish miqdori noto‘g‘ri');
  return value;
}
function recipe(row: ObjectValue) {
  if (row.preparation_formula == null) return null;
  if (typeof row.preparation_formula !== 'object' || Array.isArray(row.preparation_formula)) throw new Error('Formula ma’lumoti noto‘g‘ri');
  return Object.freeze({ ...row.preparation_formula as ObjectValue });
}
function items<T>(row: ObjectValue, key: string, decode: (value: unknown) => T): readonly T[] {
  if (!Array.isArray(row[key])) throw new Error('Ishlab chiqarish ro‘yxati noto‘g‘ri');
  return Object.freeze((row[key] as unknown[]).map(entry => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Ishlab chiqarish yozuvi noto‘g‘ri');
    return decode(entry);
  }));
}
function object(row: ObjectValue, key: string) {
  const value = row[key];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ishlab chiqarish yozuvi topilmadi');
  return value;
}
/** @v2 PreparationProductionOrder */
export function preparationProductionOrderFromJson(value: unknown) {
  const row = jsonObject(value);
  return { order_id: identity(row, 'order_id'), order_code: text(row, 'order_code'), order_title: text(row, 'order_title'),
    customer_name: text(row, 'customer_name'), active_batch_count: count(row, 'active_batch_count'), batch_count: count(row, 'batch_count'),
    roll_count: count(row, 'roll_count'), total_net_kg: amount(row, 'total_net_kg'), total_length_m: amount(row, 'total_length_m'),
    last_activity_at: text(row, 'last_activity_at') };
}
/** @v2 PreparationProductionBatch */
export function preparationProductionBatchFromJson(value: unknown) {
  const row = jsonObject(value);
  return { batch_id: identity(row, 'batch_id'), order_id: identity(row, 'order_id'), item_code: text(row, 'item_code'),
    item_name: text(row, 'item_name'), warehouse: text(row, 'warehouse'), active: row.active === true, started_at: text(row, 'started_at'),
    ended_at: text(row, 'ended_at'), last_activity_at: text(row, 'last_activity_at'), roll_count: count(row, 'roll_count'),
    total_net_kg: amount(row, 'total_net_kg'), total_length_m: amount(row, 'total_length_m'), preparation_formula: recipe(row) };
}
/** @v2 PreparationProductionRoll */
export function preparationProductionRollFromJson(value: unknown) {
  const row = jsonObject(value);
  return { epc: identity(row, 'epc'), receipt_name: text(row, 'receipt_name'), item_code: text(row, 'item_code'), item_name: text(row, 'item_name'),
    warehouse: text(row, 'warehouse'), net_kg: amount(row, 'net_kg'), gross_kg: row.gross_kg == null ? null : amount(row, 'gross_kg'),
    length_m: row.length_m == null ? null : amount(row, 'length_m'), width_mm: row.width_mm == null ? null : amount(row, 'width_mm'),
    micron: row.micron == null ? null : amount(row, 'micron'), printed_at: text(row, 'printed_at'), preparation_formula: recipe(row) };
}
/** @v2 PreparationProductionPage */
function page(row: ObjectValue) {
  if (typeof row.has_more !== 'boolean' || (row.has_more && (typeof row.next_offset !== 'number' || !Number.isInteger(row.next_offset) || row.next_offset <= 0))) {
    throw new Error('Ishlab chiqarish sahifasi noto‘g‘ri');
  }
  return { has_more: row.has_more, next_offset: typeof row.next_offset === 'number' && Number.isInteger(row.next_offset) ? row.next_offset : null };
}
/** @v2 PreparationProductionOrdersPage */
export function preparationProductionOrdersPageFromJson(value: unknown) {
  const row = jsonObject(value); return { ...page(row), orders: items(row, 'orders', preparationProductionOrderFromJson) };
}
/** @v2 PreparationProductionOrderPage */
export function preparationProductionOrderPageFromJson(value: unknown) {
  const row = jsonObject(value); return { ...page(row), order: preparationProductionOrderFromJson(object(row, 'order')), batches: items(row, 'batches', preparationProductionBatchFromJson) };
}
/** @v2 PreparationProductionBatchPage */
export function preparationProductionBatchPageFromJson(value: unknown) {
  const row = jsonObject(value); return { ...page(row), batch: preparationProductionBatchFromJson(object(row, 'batch')), rolls: items(row, 'rolls', preparationProductionRollFromJson) };
}
