import type { pendingOrderFromJson } from '../pendingOrderApi';
import { adminDartDouble } from './adminDartDouble';

type Template = ReturnType<typeof pendingOrderFromJson>['template'];
export type AdminWorkMapPendingRow = { id: string; label: string; value: string };
/** Exact passive rows from PendingOrderDetailSheet; image and completion are not supplied here. */
export function adminWorkMapPendingPresentation(template: Template, managerName: string) {
  const rows: AdminWorkMapPendingRow[] = [
    { id: 'customer', label: 'Mijoz', value: template.customer },
    { id: 'product', label: 'Mahsulot', value: template.product },
    { id: 'status', label: 'Holat', value: template.status },
  ];
  const options = template.production_options;
  if (options) {
    rows.push({ id: 'print-method', label: 'Bosma', value: options.print_method === 'flexo' ? 'Flexo' : 'Temir' });
    rows.push({ id: 'cold-glue', label: 'Holodniy kley', value: options.cold_glue ? 'Ha' : 'Yo‘q' });
    if (options.diameter_mm != null) rows.push({ id: 'diameter', label: 'Diametr', value: `${adminDartDouble(options.diameter_mm)} mm` });
  }
  rows.push({ id: 'weight', label: 'Tiraj', value: `${adminDartDouble(template.kg)} kg` },
    { id: 'frame-size', label: '1 kadrdagi o‘lcham', value: `${adminDartDouble(template.frame_product_size_mm)} mm` },
    { id: 'frame-count', label: 'Kadr soni', value: `${adminDartDouble(template.frame_count)} ta` },
    { id: 'material', label: 'Material', value: template.effective_layers.map(layer => `${layer.material} ${layer.micron}`).join(' + ') },
    { id: 'manager', label: 'Menejer', value: managerName });
  return { title: `№${template.order_number} · Chala buyurtma`, rows };
}
