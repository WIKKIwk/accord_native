import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
import { orderProductFromJson } from './workerProductionMapSaved';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const text = (value: unknown, fallback = '') => { const v = value == null ? '' : String(value).trim(); return v || fallback; };
const number = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return value;
  if (value == null || !String(value).trim()) return fallback;
  const n = Number(value); return Number.isNaN(n) ? fallback : n;
};
const integer = (value: unknown) => typeof value === 'number' ? Math.trunc(value) : /^[-+]?\d+$/.test(text(value)) ? Number(value) : 0;
export interface CalculateInput {
  kg: number; frame_product_size_mm: number; frame_count: number; edge_allowance_mm?: number; waste_percent?: number; roll_count?: number | null;
  products?: Obj[]; order_number?: string; customer?: string; product?: string; status?: string; material_display?: string; color?: string;
  layers?: Obj[]; first_layer?: Obj; second_layer?: Obj; third_layer?: Obj; note?: string;
}
export function calculateRequestToJson(input: CalculateInput) {
  const body: Obj = {};
  for (const key of ['order_number', 'customer', 'product', 'status', 'material_display', 'color'] as const)
    if (input[key]?.trim()) body[key] = input[key]!.trim();
  if (input.products?.length) body.products = input.products.map(product => ({ id: product.id, item_code: product.item_code,
    product: product.product, frame_product_size_mm: product.frame_product_size_mm, frame_count: product.frame_count }));
  Object.assign(body, { kg: input.kg, frame_product_size_mm: input.frame_product_size_mm, frame_count: input.frame_count,
    edge_allowance_mm: input.edge_allowance_mm ?? 15, waste_percent: input.waste_percent ?? 5 });
  if (input.roll_count != null) body.roll_count = input.roll_count;
  const empty = (layer: Obj) => !text(layer.material) && !text(layer.micron);
  const effective = input.layers?.length ? input.layers : [input.first_layer ?? {}, input.second_layer ?? {}, input.third_layer ?? {}].filter(layer => !empty(layer));
  const layerJson = (layer: Obj) => ({ ...(text(layer.material_id) ? { material_id: text(layer.material_id) } : {}), material: text(layer.material), micron: text(layer.micron) });
  body.layers = effective.map(layerJson); body.first_layer = layerJson(effective[0] ?? {}); body.second_layer = layerJson(effective[1] ?? {});
  if (effective[2] && !empty(effective[2])) body.third_layer = layerJson(effective[2]);
  if (input.note?.trim()) body.note = input.note.trim();
  return body;
}
export function calculateResponseFromJson(value: unknown) {
  const row = object(value) ?? {}, width = number(row.width_mm), frame = number(row.frame_product_size_mm, width > 15 ? width - 15 : 0);
  const count = number(row.frame_count, width > 0 ? 1 : 0);
  const layers = (Array.isArray(row.layers) ? row.layers : []).filter(object).map((layer: Obj) => ({
    material_id: text(layer.material_id), material: text(layer.material), micron: text(layer.micron) }));
  const results = (Array.isArray(row.results) ? row.results : []).filter(object).map((result: Obj) => Object.fromEntries(
    ['film_gsm', 'adhesive_gsm', 'total_gsm', 'first_coeff', 'other_coeff', 'coeff_sum', 'width_sm', 'base_length', 'waste_length', 'rounded_length'].map(key => [key, number(result[key])])));
  return { products: (Array.isArray(row.products) ? row.products : []).filter(object).map(orderProductFromJson), ok: row.ok === true,
    kg: number(row.kg), frame_product_size_mm: frame, frame_count: count, edge_allowance_mm: number(row.edge_allowance_mm, 15),
    width_mm: width, min_mold_size_mm: number(row.min_mold_size_mm, frame * count + 50), rubber_size_mm: integer(row.rubber_size_mm),
    waste_percent: number(row.waste_percent, 5), layers, results };
}
/** @v2 calculate */
export async function calculate(session: Session, request: CalculateInput) {
  const response = await authorizedFetch(session, '/v1/mobile/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calculateRequestToJson(request)) });
  let data: unknown; try { data = await response.json(); } catch { data = {}; }
  const payload = object(data) ?? {};
  if (response.status !== 200) throw new WorkerControlException(text(payload.error, 'calculate_failed'),
    text(payload.detail, text(payload.message, 'Calculate failed')), response.status);
  return calculateResponseFromJson(payload);
}
