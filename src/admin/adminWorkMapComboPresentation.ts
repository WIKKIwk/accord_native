import { adminText } from '../shared/localization';

type Combo = { name: string; item_code: string; revision: number };
type Product = { product: string; item_code: string; frame_product_size_mm: number; frame_count: number };
/** Product width is a Dart double interpolated directly, so whole finite values include `.0`. */
export function adminWorkMapComboWidth(value: number): string {
  return Number.isInteger(value) && Math.abs(value) < 1e21 ? `${Object.is(value, -0) ? '-0' : value}.0` : String(value);
}
export function adminWorkMapComboPresentation(combo: Combo, products: readonly Product[], locale: string) {
  return { title: adminText('calculate.combo_details', locale), version: `${adminText('calculate.combo', locale)} · v${combo.revision}`,
    name: combo.name, code: combo.item_code, componentsTitle: adminText('calculate.combo_components', locale),
    products: products.map(row => `${row.product} · ${row.item_code} · ${adminWorkMapComboWidth(row.frame_product_size_mm)} mm × ${row.frame_count}`) };
}
export type AdminWorkMapComboModel = ReturnType<typeof adminWorkMapComboPresentation>;
