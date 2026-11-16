import { adminProductionMapOrderImageUrl } from '../orderImageUri';
import type { AdminItemDetail } from './adminItemDetailModel';
import { dartTrim } from './dartJsonString';

/** Source finished-goods header does not construct an image provider when its order-image ID is absent. */
export function adminItemDetailFinishedImageUrl(baseUrl: string, detail: AdminItemDetail): string {
  const orderId = dartTrim(detail.order_image_order_id); return orderId ? adminProductionMapOrderImageUrl(baseUrl, orderId) : '';
}
