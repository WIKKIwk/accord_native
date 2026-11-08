import { adminText } from '../shared/localization';
import { adminDartDouble } from './adminDartDouble';

type Combo = { name: string; item_code: string; revision: number };
type Product = { product: string; item_code: string; frame_product_size_mm: number; frame_count: number };
export const adminWorkMapComboWidth = adminDartDouble;
export function adminWorkMapComboPresentation(combo: Combo, products: readonly Product[], locale: string) {
  return { title: adminText('calculate.combo_details', locale), version: `${adminText('calculate.combo', locale)} · v${combo.revision}`,
    name: combo.name, code: combo.item_code, componentsTitle: adminText('calculate.combo_components', locale),
    products: products.map(row => `${row.product} · ${row.item_code} · ${adminWorkMapComboWidth(row.frame_product_size_mm)} mm × ${row.frame_count}`) };
}
export type AdminWorkMapComboModel = ReturnType<typeof adminWorkMapComboPresentation>;
