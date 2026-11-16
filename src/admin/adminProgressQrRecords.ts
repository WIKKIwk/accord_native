import { dartJsonString, dartTrim } from './dartJsonString';

type ObjectValue = Record<string, unknown>;
const isObject = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
export function adminProgressQrObject(value: unknown): ObjectValue {
  if (!isObject(value)) throw new TypeError('Invalid progress QR object'); return value;
}
export function adminProgressQrList(value: unknown): readonly unknown[] {
  if (value == null) return []; if (!Array.isArray(value)) throw new TypeError('Invalid progress QR list'); return value;
}
export const adminProgressQrOptionalObject = (value: unknown): ObjectValue | null => isObject(value) ? value : null;
export const adminProgressQrText = (value: unknown) => value == null ? '' : dartJsonString(value);
const trimmed = (value: unknown) => dartTrim(adminProgressQrText(value));
const integer = (value: unknown) => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid progress QR timestamp');
  return Math.trunc(value);
};

/** @v2 AdminProgressBatchCorrectionRecord */
export function adminProgressQrCorrectionFromJson(value: unknown) {
  const row = adminProgressQrObject(value), actor = adminProgressQrOptionalObject(row.actor) ?? {};
  return Object.freeze({ batch_id: adminProgressQrText(row.batch_id), previous_revision: integer(row.previous_revision), new_revision: integer(row.new_revision),
    reason: adminProgressQrText(row.reason), actor_role: adminProgressQrText(actor.role), actor_ref: adminProgressQrText(actor.ref_ ?? actor.ref),
    actor_display_name: adminProgressQrText(actor.display_name), old_values: Object.freeze({ ...adminProgressQrOptionalObject(row.old_values) }),
    new_values: Object.freeze({ ...adminProgressQrOptionalObject(row.new_values) }), created_at_unix: integer(row.created_at_unix) });
}
/** @v2 AdminProgressQrOpenedBy */
export function adminProgressQrOpenedByFromJson(value: unknown) {
  const row = adminProgressQrObject(value);
  return Object.freeze({ actor_role: adminProgressQrText(row.actor_role), actor_ref: adminProgressQrText(row.actor_ref),
    actor_display_name: adminProgressQrText(row.actor_display_name), opened_at_unix: integer(row.opened_at_unix) });
}
/** @v2 AdminProgressQrLineageEdge */
export function adminProgressQrLineageEdgeFromJson(value: unknown) {
  const row = adminProgressQrObject(value); return Object.freeze({ parent_batch_id: trimmed(row.parent_batch_id), child_batch_id: trimmed(row.child_batch_id) });
}
/** @v2 AdminProgressQrMaterial */
export function adminProgressQrMaterialFromJson(value: unknown) {
  const row = adminProgressQrObject(value); return Object.freeze({ barcode: trimmed(row.barcode), item_code: trimmed(row.item_code), item_name: trimmed(row.item_name) });
}
/** @v2 AdminProgressQrSessionResources */
export function adminProgressQrSessionResourcesFromJson(value: unknown) {
  const row = adminProgressQrObject(value);
  return Object.freeze({ session_id: trimmed(row.session_id), raw_materials_available: row.raw_materials_available === true, qolip_available: row.qolip_available === true,
    raw_materials: Object.freeze(adminProgressQrList(row.raw_materials).filter(isObject).map(adminProgressQrMaterialFromJson)),
    qolip_codes: Object.freeze(adminProgressQrList(row.qolip_codes).filter((code): code is string => typeof code === 'string' && !!dartTrim(code)).map(dartTrim)) });
}
