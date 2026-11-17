import { calculateOrderTemplateFromJson as decodeTemplate } from '../workerOpenedOrderEditApi';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';

// The existing opened-order reader owns the template representation. Archive and
// editor callers share that type rather than maintaining another copy of its DTO.
export type CalculateOrderTemplate = ReturnType<typeof decodeTemplate>;
type Json = Record<string, unknown>;
const object = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => value == null ? '' : dartTrim(dartJsonString(value));
const stringFields = ['id', 'code', 'name', 'order_number', 'customer_ref', 'customer', 'item_code', 'product', 'status',
  'material_display', 'color', 'image_id', 'image_name', 'image_mime', 'image_url', 'first_layer_material', 'first_layer_micron',
  'second_layer_material', 'second_layer_micron', 'third_layer_material', 'third_layer_micron', 'note', 'source_map_id', 'variant_id'] as const;
const numericFields = ['image_size_bytes', 'frame_product_size_mm', 'frame_count', 'print_val_size_mm', 'edge_allowance_mm',
  'width_mm', 'waste_percent', 'roll_count', 'kg'] as const;

/** @v2 CalculateOrderTemplate.fromJson */
export function calculateOrderTemplateFromJson(value: unknown): CalculateOrderTemplate {
  if (!object(value)) throw new TypeError('Expected a template object');
  // _calculateText uses Dart's Object.toString and trim, including NEXT LINE.
  // Normalize those inputs before reusing the existing common decoder.
  const row: Json = { ...value };
  for (const key of stringFields) row[key] = text(value[key]);
  for (const key of numericFields) if (typeof row[key] === 'string') row[key] = dartTrim(row[key]);
  if (typeof row.saved_at === 'string') row.saved_at = dartTrim(row.saved_at);
  if (Array.isArray(value.layers)) row.layers = value.layers.map(layer => object(layer)
    ? { material_id: text(layer.material_id), material: text(layer.material), micron: text(layer.micron) } : layer);
  if (object(value.production_options)) row.production_options = { ...value.production_options,
    print_method: text(value.production_options.print_method),
    diameter_mm: typeof value.production_options.diameter_mm === 'string' ? dartTrim(value.production_options.diameter_mm) : value.production_options.diameter_mm };
  if (object(value.combo)) {
    row.combo = { ...value.combo };
    for (const key of ['id', 'item_code', 'name', 'layout_fingerprint']) (row.combo as Json)[key] = value.combo[key] == null ? '' : dartJsonString(value.combo[key]);
  }
  return decodeTemplate(row);
}

/** @v2 CalculateOrderTemplate.effectiveLayers */
export function calculateOrderTemplateEffectiveLayers(template: CalculateOrderTemplate): CalculateOrderTemplate['layers'] {
  if (template.layers.length) return template.layers;
  return ['first', 'second', 'third'].map(prefix => ({ material_id: '',
    material: template[`${prefix}_layer_material` as 'first_layer_material'],
    micron: template[`${prefix}_layer_micron` as 'first_layer_micron'] }))
    .filter(layer => dartTrim(layer.material) !== '' || dartTrim(layer.micron) !== '');
}

/** @v2 CalculateOrderTemplate.effectivePrintMethod */
export function calculateOrderTemplateEffectivePrintMethod(template: CalculateOrderTemplate): string {
  const method = dartPartialLower(dartTrim(template.production_options?.print_method ?? ''));
  if (method === 'flexo' || method === 'metal') return method;
  const status = dartPartialLower(dartTrim(template.status));
  return status === 'flexo' ? 'flexo' : ['rulon', 'rulo', 'paket'].includes(status) ? 'metal' : '';
}

function utcIso(date: CalculateOrderTemplate['saved_at']): string {
  const iso = date.toISOString(), microsecond = date.microsecond ?? 0;
  return microsecond ? iso.replace(/(\.\d{3})Z$/, `$1${String(microsecond).padStart(3, '0')}Z`) : iso;
}

/** @v2 CalculateOrderTemplate.toJson */
export function calculateOrderTemplateToJson(template: CalculateOrderTemplate): Json {
  const layers = calculateOrderTemplateEffectiveLayers(template);
  const legacy = (index: number) => layers[index] ?? { material_id: '', material: '', micron: '' };
  const options = template.production_options;
  return {
    ...(template.combo !== null ? { combo: { id: template.combo.id, item_code: template.combo.item_code, name: template.combo.name,
      revision: template.combo.revision, layout_fingerprint: template.combo.layout_fingerprint } } : {}),
    ...(options !== null ? { production_options: { print_method: options.print_method, cold_glue: options.cold_glue,
      ...(options.diameter_mm !== null ? { diameter_mm: options.diameter_mm } : {}) } } : {}),
    ...(dartTrim(template.id) ? { id: dartTrim(template.id) } : {}),
    ...(dartTrim(template.code) ? { code: dartTrim(template.code) } : {}),
    name: dartTrim(template.name),
    ...(template.saved_at.getTime() > 0 ? { saved_at: utcIso(template.saved_at) } : {}),
    order_number: dartTrim(template.order_number), customer_ref: dartTrim(template.customer_ref), customer: dartTrim(template.customer),
    ...(template.products.length ? { products: template.products.map(product => ({ id: product.id, item_code: product.item_code,
      product: product.product, frame_product_size_mm: product.frame_product_size_mm, frame_count: product.frame_count })) } : {}),
    item_code: dartTrim(template.item_code), product: dartTrim(template.product), status: dartTrim(template.status),
    material_display: dartTrim(template.material_display), color: dartTrim(template.color), image_id: dartTrim(template.image_id),
    image_name: dartTrim(template.image_name), image_mime: dartTrim(template.image_mime), image_size_bytes: template.image_size_bytes,
    image_url: dartTrim(template.image_url), frame_product_size_mm: template.frame_product_size_mm, frame_count: template.frame_count,
    ...(template.print_val_size_mm !== null ? { print_val_size_mm: template.print_val_size_mm } : {}),
    edge_allowance_mm: template.edge_allowance_mm, width_mm: template.width_mm, waste_percent: template.waste_percent,
    ...(template.roll_count !== null ? { roll_count: template.roll_count } : {}),
    layers: layers.map(layer => ({ ...(dartTrim(layer.material_id) ? { material_id: dartTrim(layer.material_id) } : {}),
      material: dartTrim(layer.material), micron: dartTrim(layer.micron) })),
    first_layer_material: dartTrim(legacy(0).material), first_layer_micron: dartTrim(legacy(0).micron),
    second_layer_material: dartTrim(legacy(1).material), second_layer_micron: dartTrim(legacy(1).micron),
    third_layer_material: dartTrim(legacy(2).material), third_layer_micron: dartTrim(legacy(2).micron), note: dartTrim(template.note),
    ...(template.kg > 0 ? { kg: template.kg } : {}),
    ...(dartTrim(template.source_map_id) ? { source_map_id: dartTrim(template.source_map_id) } : {}),
    ...(template.variant_id !== '' ? { variant_id: template.variant_id } : {}),
  };
}
