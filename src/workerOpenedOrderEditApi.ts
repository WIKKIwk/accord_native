import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { comboFromJson, orderProductFromJson } from './workerProductionMapSaved';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const requiredObject = (value: unknown): Obj => { const row = object(value); if (!row) throw new TypeError('Expected an object'); return row; };
const text = (value: unknown): string => value == null ? '' : String(value).trim();
const optionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  const str = text(value);
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(str)) return null;
  return /^[+-]?NaN$/.test(str) ? NaN : Number(str);
};
const num = (value: unknown, fallback = 0): number => optionalNumber(value) ?? fallback;
const integer = (value: unknown): number => {
  if (typeof value === 'number') return Math.trunc(value);
  const str = text(value); return /^[+-]?\d+$/.test(str) ? Number(str) : 0;
};
function date(value: unknown): Date {
  const str = text(value);
  if (!str) return new Date(0);
  const parsed = /^\d{4}-?\d{2}-?\d{2}/.test(str) ? Date.parse(str) : NaN;
  if (!Number.isNaN(parsed)) return new Date(parsed);
  if (/^[+-]?\d+$/.test(str)) return new Date(Math.trunc(Number(str) / 1000));
  return new Date(0);
}
function layer(value: Obj) { return { material_id: text(value.material_id), material: text(value.material), micron: text(value.micron) }; }
const layerPresent = (value: ReturnType<typeof layer>) => !!value.material || !!value.micron;

export function calculateOrderTemplateFromJson(value: unknown) {
  const row = requiredObject(value);
  if (row.layers != null && !Array.isArray(row.layers)) throw new TypeError('Invalid template layers');
  const layers = (row.layers as unknown[] | null | undefined ?? []).filter(item => object(item)).map(item => layer(requiredObject(item))).filter(layerPresent);
  const width = num(row.width_mm), production = object(row.production_options);
  const legacy = ['first', 'second', 'third'].map(n => layer({ material: row[`${n}_layer_material`], micron: row[`${n}_layer_micron`] })).filter(layerPresent);
  const effective = layers.length ? layers : legacy;
  return { products: (Array.isArray(row.products) ? row.products.filter(item => object(item)) : []).map(orderProductFromJson),
    combo: comboFromJson(row.combo), production_options: production ? { print_method: text(production.print_method),
      cold_glue: production.cold_glue === true, diameter_mm: optionalNumber(production.diameter_mm) } : null,
    id: text(row.id), code: text(row.code), name: text(row.name), saved_at: date(row.saved_at), order_number: text(row.order_number),
    customer_ref: text(row.customer_ref), customer: text(row.customer), item_code: text(row.item_code), product: text(row.product),
    status: text(row.status), material_display: text(row.material_display), color: text(row.color), image_id: text(row.image_id),
    image_name: text(row.image_name), image_mime: text(row.image_mime), image_size_bytes: integer(row.image_size_bytes), image_url: text(row.image_url),
    frame_product_size_mm: num(row.frame_product_size_mm, width > 15 ? width - 15 : 0), frame_count: num(row.frame_count, width > 0 ? 1 : 0),
    print_val_size_mm: optionalNumber(row.print_val_size_mm), edge_allowance_mm: num(row.edge_allowance_mm, 15), width_mm: width,
    waste_percent: num(row.waste_percent, 5), roll_count: optionalNumber(row.roll_count), layers,
    first_layer_material: text(row.first_layer_material), first_layer_micron: text(row.first_layer_micron),
    second_layer_material: text(row.second_layer_material), second_layer_micron: text(row.second_layer_micron),
    third_layer_material: text(row.third_layer_material), third_layer_micron: text(row.third_layer_micron),
    note: text(row.note), kg: num(row.kg), source_map_id: text(row.source_map_id), variant_id: text(row.variant_id), effective_layers: effective };
}

/** @v2 OpenedOrderEditRestrictions */
export function openedOrderEditRestrictionsFromJson(value: unknown) {
  if (value == null) return { locked_layer_indices: new Set<number>(), dimensions_locked: false, layer_structure_locked: false, unresolved_materials: false };
  const row = object(value);
  if (!row || !Array.isArray(row.locked_layer_indices) || typeof row.dimensions_locked !== 'boolean' ||
      typeof row.layer_structure_locked !== 'boolean' || typeof row.unresolved_materials !== 'boolean') {
    throw new TypeError('Invalid order edit restrictions');
  }
  if (row.locked_layer_indices.some(index => !Number.isInteger(index) || index < 0)) throw new TypeError('Invalid order edit layer restrictions');
  if (row.dimensions_locked !== row.layer_structure_locked ||
      ((row.locked_layer_indices.length > 0 || row.unresolved_materials) && !row.layer_structure_locked)) {
    throw new TypeError('Inconsistent order edit restrictions');
  }
  return { locked_layer_indices: new Set<number>(row.locked_layer_indices), dimensions_locked: row.dimensions_locked,
    layer_structure_locked: row.layer_structure_locked, unresolved_materials: row.unresolved_materials };
}

/** @v2 OpenedOrderEditSource */
export function openedOrderEditSourceFromJson(value: unknown) {
  const original = requiredObject(value), template = calculateOrderTemplateFromJson(original.template);
  const restrictions = openedOrderEditRestrictionsFromJson(original.restrictions);
  if ([...restrictions.locked_layer_indices].some(index => index >= template.effective_layers.length) ||
      (restrictions.unresolved_materials && restrictions.locked_layer_indices.size !== template.effective_layers.length)) {
    throw new TypeError('Invalid order edit layer restrictions');
  }
  return { original, template, restrictions, get order_id(): string {
    const orderId = requiredObject(original.map).id;
    if (typeof orderId !== 'string') throw new TypeError('Invalid order ID');
    return orderId;
  } };
}

function editError(status: number, payload: unknown): WorkerControlException {
  const data = object(payload);
  if (typeof data?.error === 'string' && typeof data.message === 'string' && data.error.startsWith('order_edit_') &&
      status !== 401 && status !== 403 && data.message.trim() && !/[<>]/.test(data.message)) {
    return new WorkerControlException(data.error, data.message.trim(), status);
  }
  const error = productionMapResponseError(status, payload, 'order_edit');
  if (error.code.trim().toLowerCase() === 'apparatus and order_id are required') {
    error.message = 'Aparat yoki buyurtma ma’lumoti topilmadi. Oynani yangilang.';
    return error;
  }
  if ([400, 404, 409, 422].includes(status) && error.message.includes('Server xato kodi:') &&
      /\s/.test(error.code.trim()) && !/[<>]/.test(error.code)) {
    error.message = error.code.trim();
  }
  return error;
}

/** @v2 adminOpenedOrderEditSource */
export async function adminOpenedOrderEditSource(session: Session, orderId: string) {
  const query = new URLSearchParams({ id: orderId });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/order-edit?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw editError(response.status, payload);
  }
  return openedOrderEditSourceFromJson(await response.json());
}
