import type { Session } from '../auth';
import { calculate } from '../calculateApi';
import type { calculateOrderTemplateFromJson } from '../workerOpenedOrderEditApi';
import type { productionMapDefinitionFromJson } from '../workerProductionMapSaved';

type OrderMap = ReturnType<typeof productionMapDefinitionFromJson>;
type Template = ReturnType<typeof calculateOrderTemplateFromJson>;

/** @v2 _openedOrderProductTitle */
export function preparationOrderProductTitle(map: OrderMap) {
  return map.nodes.find(node => node.kind === 'end' && node.title.trim() && node.title.trim() !== map.title.trim())?.title.trim() ?? '';
}
/** @v2 _openedOrderDisplayCode */
export function preparationOrderDisplayCode(map: OrderMap) {
  return map.code.trim() || map.order_number.trim() || (map.id.startsWith('zakaz-') ? map.id.slice(6).trim() : '');
}
/** @v2 _calculateTemplateForProductionMap */
export function preparationOrderTemplate(map: OrderMap, templates: readonly Template[]): Template | null {
  const id = map.id.trim();
  const direct = templates.find(template => template.source_map_id.trim() === id);
  if (direct) return direct;
  const keys = new Set([map.order_number.trim(), map.code.trim(), id.startsWith('zakaz-') ? id.slice(6).trim() : ''].filter(Boolean));
  const byOrder = templates.find(template => keys.has(template.order_number.trim()) || keys.has(template.code.trim()));
  if (byOrder) return byOrder;
  const products = new Set([map.product_code, map.title, preparationOrderProductTitle(map)].map(value => value.trim().toLowerCase()).filter(Boolean));
  let fallback: Template | null = null;
  for (const template of templates) {
    if (!products.has(template.product.trim().toLowerCase()) && !products.has(template.item_code.trim().toLowerCase())) continue;
    if (map.width_mm && map.width_mm > 0 && template.width_mm > 0 && Math.abs(map.width_mm - template.width_mm) > 0.5) continue;
    fallback = template;
    if (template.source_map_id.trim()) return template;
  }
  return fallback;
}

/** @v2 _productionMapBaseMetrajForOrder */
export async function preparationOrderMetrics(session: Session, map: OrderMap, templates: readonly Template[]) {
  const template = preparationOrderTemplate(map, templates);
  const kg = map.order_kg != null && map.order_kg > 0 ? map.order_kg : template && template.kg > 0 ? template.kg : null;
  if (map.base_length != null && map.base_length > 0) return { kg, length: map.base_length };
  const calculationKg = template && template.kg > 0 ? template.kg : map.order_kg ?? 0;
  const width = template && template.width_mm > 0 ? template.width_mm : map.width_mm ?? 0;
  if (calculationKg <= 0 || width <= 0) return { kg, length: null };
  try {
    const result = await calculate(session, { kg: calculationKg, product: template?.product || map.title,
      frame_product_size_mm: template && template.frame_product_size_mm > 0 ? template.frame_product_size_mm : width > 15 ? width - 15 : 0,
      frame_count: template && template.frame_count > 0 ? template.frame_count : 1,
      ...(template ? { products: template.products, order_number: template.order_number || map.order_number, customer: template.customer,
        status: template.status, material_display: template.material_display, color: template.color, edge_allowance_mm: template.edge_allowance_mm,
        waste_percent: template.waste_percent, layers: template.effective_layers, note: template.note } : {}),
      roll_count: template?.roll_count ?? map.roll_count });
    const length = result.results[0]?.rounded_length;
    return { kg, length: typeof length === 'number' && length > 0 ? length : null };
  } catch { return { kg, length: null }; }
}
