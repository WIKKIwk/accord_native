import type { orderProductFromJson } from '../workerProductionMapSaved';
import type { AdminItemDetailCombo } from './adminItemDetailComboApi';
import { dartPartialLower, dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';

export type AdminItemDetailComboProduct = ReturnType<typeof orderProductFromJson>;
/** @v2 _ComboItemDetailViewState.build; immutable image ID takes precedence over the saved URL. */
export function adminItemDetailComboImageUrl(entry: AdminItemDetailCombo | null): string {
  if (!entry) return ''; const imageId = dartTrim(entry.template.image_id);
  return imageId ? `/v1/mobile/calculate/orders/image/view?id=${dartQueryComponent(imageId)}` : dartTrim(entry.template.image_url);
}
/** A source product label equal to its SKU is not a known display name. */
export function adminItemDetailComboKnownName(product: Pick<AdminItemDetailComboProduct, 'product' | 'item_code'>): string | null {
  const name = dartTrim(product.product), code = dartTrim(product.item_code); return name && dartPartialLower(name) !== dartPartialLower(code) ? name : null;
}
/** @v2 formatRawQuantity; no locale rounding or trailing .0 is introduced for component dimensions. */
export function adminItemDetailComboSize(product: Pick<AdminItemDetailComboProduct, 'frame_product_size_mm' | 'frame_count'>): string {
  return `${Object.is(product.frame_product_size_mm, -0) ? '-0' : String(product.frame_product_size_mm)} mm × ${product.frame_count}`;
}
