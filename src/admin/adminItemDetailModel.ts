import { adminUserCreateCustomerFromJson, type AdminUserCreateCustomer } from './adminUserCreateModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminItemDetailCustomer = AdminUserCreateCustomer;
export type AdminItemDetail = Readonly<{
  code: string; name: string; uom: string; item_group: string; is_finished_goods: boolean;
  created_at_unix: number; updated_at_unix: number; order_image_order_id: string;
  customers: readonly AdminItemDetailCustomer[];
}>;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => { if (value == null) return ''; if (typeof value !== 'string') throw new TypeError('Invalid item detail string'); return value; };
const boolean = (value: unknown): boolean => { if (value == null) return false; if (typeof value !== 'boolean') throw new TypeError('Invalid item detail boolean'); return value; };
const integer = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid item detail timestamp');
  return Math.trunc(value);
};

/** @v2 AdminItemDetail.fromJson; timestamps use num.toInt and non-map customer rows are ignored. */
export function adminItemDetailFromJson(value: unknown): AdminItemDetail {
  if (!object(value)) throw new TypeError('Invalid item detail');
  return Object.freeze({ code: text(value.code), name: text(value.name), uom: text(value.uom), item_group: text(value.item_group),
    is_finished_goods: boolean(value.is_finished_goods), created_at_unix: integer(value.created_at_unix), updated_at_unix: integer(value.updated_at_unix),
    order_image_order_id: text(value.order_image_order_id),
    customers: Object.freeze(Array.isArray(value.customers) ? value.customers.filter(object).map(adminUserCreateCustomerFromJson) : []) });
}

/** Source checks combo before isFinishedGoods, including a DTO carrying both flags. */
export function adminItemDetailKind(detail: AdminItemDetail): 'ordinary' | 'finished' | 'combo' {
  return dartPartialLower(dartTrim(detail.item_group)) === 'kombo' ? 'combo' : detail.is_finished_goods ? 'finished' : 'ordinary';
}

/** @v2 _retainImage; a renamed code must not inherit the previous item's image. */
export function retainAdminItemDetailImage(updated: AdminItemDetail, previous: AdminItemDetail): AdminItemDetail {
  return updated.order_image_order_id !== '' || updated.code !== previous.code ? updated : Object.freeze({ ...updated, order_image_order_id: previous.order_image_order_id });
}
