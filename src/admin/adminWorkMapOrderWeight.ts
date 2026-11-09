import { dartPartialLower, dartTrim } from './dartJsonString';

type OrderMap = { id?: string; code?: string; order_number?: string; product_code?: string; title?: string;
  width_mm?: number | null; order_kg?: number | null; nodes?: readonly { kind?: string; title?: string }[] };
type Template = { source_map_id?: string; order_number?: string; code?: string; product?: string; item_code?: string;
  width_mm?: number | null; kg?: number | null };
const clean = (value: unknown) => typeof value === 'string' ? dartTrim(value) : '';
const lower = (value: unknown) => dartPartialLower(clean(value));

/** V2's template selection for passive order metrics, using only an already-hydrated detail snapshot. */
export function adminWorkMapTemplateForOrder(map: OrderMap, templates: readonly Template[]): Template | undefined {
  const id = clean(map.id), title = clean(map.title);
  for (const template of templates) if (clean(template.source_map_id) === id) return template;
  const keys = new Set([clean(map.order_number), clean(map.code), id.startsWith('zakaz-') ? clean(id.slice(6)) : ''].filter(Boolean));
  for (const template of templates) if (keys.has(clean(template.order_number)) || keys.has(clean(template.code))) return template;
  const product = map.nodes?.find(node => node.kind === 'end' && clean(node.title) && clean(node.title) !== title)?.title;
  const products = new Set([lower(map.product_code), lower(map.title), lower(product)].filter(Boolean));
  if (!products.size) return undefined;
  let fallback: Template | undefined;
  for (const template of templates) {
    if (!products.has(lower(template.product)) && !products.has(lower(template.item_code))) continue;
    if (map.width_mm != null && map.width_mm > 0 && template.width_mm != null && template.width_mm > 0 &&
        Math.abs(map.width_mm - template.width_mm) > 0.5) continue;
    fallback = template;
    if (clean(template.source_map_id)) return template;
  }
  return fallback;
}

/** A positive stored weight wins; otherwise the selected template supplies a positive weight. */
export function adminWorkMapOrderWeight(map: OrderMap, templates: readonly Template[]): number | null {
  if (map.order_kg != null && map.order_kg > 0) return map.order_kg;
  const kg = adminWorkMapTemplateForOrder(map, templates)?.kg;
  return kg != null && kg > 0 ? kg : null;
}
