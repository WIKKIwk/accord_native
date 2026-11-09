import { productionText } from '../shared/localization';
import type { AdminOrderSummary } from './adminOrderSummaryApi';
import { dartTrim } from './dartJsonString';

export type AdminWorkMapSummaryBlock = { id: string; kind: 'text' | 'heading' | 'row' | 'divider' | 'retry'; label?: string; value?: string };
export type AdminWorkMapSummaryModel = { title: string; expanded: boolean; canExpand: boolean; blocks: readonly AdminWorkMapSummaryBlock[] };
type MapSummary = { base_length?: number | null; order_kg?: number | null; width_mm?: number | null; standard_print_side?: boolean | null };
type State = { expanded: boolean; canExpand: boolean; loading: boolean; failed: boolean; value?: AdminOrderSummary };
/** V2's integer raw-quantity branch uses fixed digits, including the actual binary value above 2^53. */
export function adminWorkMapRawQuantity(value: number): string {
  return Object.is(value, -0) ? '-0' : Number.isInteger(value) && Math.abs(value) < 1e21 ? value.toFixed(0) : String(value);
}
export function adminWorkMapSummaryPresentation(map: MapSummary | null, state: State, locale: string): AdminWorkMapSummaryModel {
  const text = (key: string, values: Record<string, unknown> = {}) => productionText(`worker.summary.${key}`, locale, values);
  const blocks: AdminWorkMapSummaryBlock[] = [], result = { title: text('expected.title'), expanded: state.expanded, canExpand: state.canExpand, blocks };
  if (!state.expanded || !map) return result;
  const row = (id: string, label: string, value: string) => blocks.push({ id, kind: 'row', label, value });
  const line = (id: string, label: string, kind: 'text' | 'heading' = 'text') => blocks.push({ id, kind, label });
  const divider = (id: string) => blocks.push({ id, kind: 'divider' });
  const basic = () => {
    line('subtitle', text('expected.subtitle'));
    if (map.base_length != null && Number.isFinite(map.base_length) && map.base_length > 0) {
      const planned = Math.ceil(map.base_length / 500) * 500;
      // Extreme integer/VM overflow parity is unverified; do not fabricate a rounded metric outside JS's exact domain.
      if (Number.isSafeInteger(planned)) row('length', text('length'), text('length_value', { value: String(planned) }));
    }
    if (map.order_kg != null && map.order_kg > 0) row('weight', text('weight'), text('weight_value', { value: adminWorkMapRawQuantity(map.order_kg) }));
    row('print-side', productionText('order.print_side', locale), productionText(map.standard_print_side === false ? 'order.print_side.nonstandard' : 'order.print_side.standard', locale));
  };
  const calculation = state.value;
  if (state.loading || state.failed || !calculation) {
    basic();
    if (state.failed) { divider('unavailable-divider'); line('unavailable', text('calculation_unavailable')); blocks.push({ id: 'retry', kind: 'retry', label: text('calculation_retry') }); }
    else line('loading', text('calculation_loading'));
    return result;
  }
  line('materials-title', text('materials'), 'heading');
  if (!calculation.effective_layers.length) line('materials-empty', text('materials_missing'));
  calculation.effective_layers.forEach((layer, index) => row(`layer-${index}`, text('layer', { index: index + 1 }),
    [dartTrim(layer.material), dartTrim(layer.micron) ? text('micron_value', { value: dartTrim(layer.micron) }) : ''].filter(Boolean).join(' · ')));
  const width = map.width_mm ?? calculation.width_mm;
  if (Number.isFinite(width) && width > 0) row('width', text('material_width'), `${adminWorkMapRawQuantity(width)} mm`);
  divider('summary-divider'); basic(); row('waste', text('waste_percent'), `${adminWorkMapRawQuantity(calculation.waste_percent)} %`);
  line('planned', text('planned_explanation'));
  if (calculation.products.length) {
    divider('products-divider'); line('products-title', text('product_frames'), 'heading');
    calculation.products.forEach((product, index) => row(`product-${index}`, product.product, text('product_frame_value', {
      code: product.item_code, count: product.frame_count, width: adminWorkMapRawQuantity(product.frame_product_size_mm) })));
  }
  if (dartTrim(calculation.note)) { divider('note-divider'); line('note-title', text('note'), 'heading'); line('note', dartTrim(calculation.note)); }
  return result;
}
