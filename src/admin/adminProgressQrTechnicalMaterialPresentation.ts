import type { AdminProgressQrMaterialReport } from './adminProgressQrFallbackModel';
import { dartTrim } from './dartJsonString';

/** @v2 _quantityTextFromParts
 * Source formatQuantityWithUnit uses fixed two places only for non-whole values, then trims trailing zeros. */
export function adminProgressQrQuantityParts(value: number, unit: string): string {
  let quantity = value.toFixed(Number.isInteger(value) || !Number.isFinite(value) ? 0 : 2);
  if (Object.is(value, -0)) quantity = '-0';
  if (!Number.isInteger(value) && Number.isFinite(value)) quantity = quantity.replace(/0+$/, '').replace(/\.$/, '');
  const suffix = dartTrim(unit); return suffix ? `${quantity} ${suffix}` : quantity;
}
/** @v2 _displayNumber
 * Dart VM double.toInt saturates at signed64 bounds; these are exact decimal outputs, not rounded JS string interpolation. */
export function adminProgressQrDisplayNumber(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) throw RangeError('Non-finite Dart double cannot be converted to int');
  if (!Number.isInteger(value)) return String(value);
  if (value >= 9223372036854775808) return '9223372036854775807';
  if (value <= -9223372036854775808) return '-9223372036854775808';
  return value.toFixed(0);
}
/** @v2 _rawMaterialStatusLabel */
export function adminProgressQrMaterialStatus(value: string, p: (key: string) => string): string {
  const keys: Record<string, string> = { available: 'worker.qr.material.status_available', in_use: 'worker.qr.material.status_in_use', consumed: 'worker.qr.material.status_consumed', reserved: 'worker.qr.material.status_reserved' };
  const key = dartTrim(value); return Object.hasOwn(keys, key) ? p(keys[key]) : value;
}
export type AdminProgressQrTechnicalRow = Readonly<{ id: string; label: string; value: string }>;
/** @v2 _TechnicalRawMaterialSection
 * Current052's explicit Metalayzer row is retained; empty Source InfoRows disappear without trimming displayed values. */
export function adminProgressQrTechnicalMaterial(report: AdminProgressQrMaterialReport, apparatusNamesById: ReadonlyMap<string, string>, p: (key: string) => string): readonly AdminProgressQrTechnicalRow[] {
  const rows: AdminProgressQrTechnicalRow[] = [];
  const add = (id: string, key: string | null, value: string) => { if (dartTrim(value)) rows.push(Object.freeze({ id, label: key === null ? 'Metalayzer' : p(key), value })); };
  add('barcode', 'worker.qr.report.barcode', report.barcode); add('warehouse', 'worker.qr.report.warehouse', report.warehouse);
  add('item-code', 'worker.qr.report.item_code', report.item_code); add('item-name', 'worker.qr.report.item_name', report.item_name); add('item-group', 'worker.qr.report.item_group', report.item_group);
  add('quantity', 'worker.wip.info.quantity', adminProgressQrQuantityParts(report.qty, report.uom)); add('status', 'worker.qr.report.status', adminProgressQrMaterialStatus(report.status, p));
  add('metalayzer', null, report.is_metalayzer ? 'Metalayzer bo‘ldi' : 'Metalayzer bo‘lmagan');
  add('receipt', 'worker.qr.report.receipt', report.source_receipt_id); add('reserved-order', 'worker.qr.report.reserved_order', report.reserved_order_id);
  const assignment = report.assignment;
  if (assignment) {
    add('assigned-order', 'worker.qr.report.assigned_order', assignment.order_id);
    const apparatus = dartTrim(assignment.apparatus), name = apparatus ? dartTrim(apparatusNamesById.get(apparatus) ?? '') : '';
    add('assigned-machine', 'worker.qr.report.assigned_machine', name || apparatus);
    add('assigned-by-ref', 'worker.qr.report.assigned_by_ref', assignment.assigned_by_ref); add('assigned-by-name', 'worker.qr.report.assigned_by_name', assignment.assigned_by_name);
    add('assigned-at', 'worker.qr.report.assigned_at', assignment.assigned_at); add('stock-status', 'worker.qr.report.stock_status', assignment.stock_status); add('stock-warehouse', 'worker.qr.report.stock_warehouse', assignment.stock_warehouse);
    add('stock-quantity', 'worker.qr.report.stock_quantity', adminProgressQrDisplayNumber(assignment.stock_qty)); add('received-quantity', 'worker.qr.report.received_quantity', adminProgressQrDisplayNumber(assignment.received_qty));
    add('consumed-quantity', 'worker.qr.report.consumed_quantity', adminProgressQrDisplayNumber(assignment.consumed_qty)); add('remaining-quantity', 'worker.qr.report.remaining_quantity', adminProgressQrDisplayNumber(assignment.remaining_qty));
  }
  return Object.freeze(rows);
}
