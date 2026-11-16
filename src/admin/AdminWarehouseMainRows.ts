import type { AdminApparatus } from '../apparatusApi';
import type { RawMaterialStock } from '../shared/printApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import { workerRawQuantity } from '../workerPeremotka';
import { parseDartDateTime } from '../qolip/qolipApiCommon';
import type { AdminWarehouseMainQolipGroup } from './adminWarehouseMainModel';
import type { AdminWarehouseStockItem } from './warehouseStockApi';
import { dartPartialLower, dartTrim } from './dartJsonString';

type Text = (key: string, values?: Record<string, unknown>) => string;
export type AdminWarehouseMainDetailLine = { label: string; value: string };
type BaseRow = { id: string; title: string; subtitle: string; icon: 'item' | 'qolip' | 'raw' | 'reservation'; details: readonly AdminWarehouseMainDetailLine[]; orderId: string };
export type AdminWarehouseMainRow = BaseRow & (
  | { kind: 'item'; item: AdminWarehouseStockItem }
  | { kind: 'qolip'; group: AdminWarehouseMainQolipGroup }
  | { kind: 'raw'; stock: RawMaterialStock; canEdit: boolean; canQr: boolean }
  | { kind: 'reservation'; stock: RawMaterialStock | null; reservation: AdminRawMaterialAssignment; canQr: boolean }
);
const lower = (value: string) => dartPartialLower(dartTrim(value));
const qty = (value: number, unit = '') => dartTrim(`${workerRawQuantity(value)} ${unit}`);
const line = (label: string, value: string): AdminWarehouseMainDetailLine => ({ label, value });
/** Source detail lines preserve '-' for blank values and never invent a field. */
export const adminWarehouseMainDetailValue = (value: string) => dartTrim(value) || '-';
export function adminWarehouseMainRawLines(stock: RawMaterialStock, t: Text, includeReservation = true): AdminWarehouseMainDetailLine[] {
  const status = lower(stock.status), statusKey = status === 'band' ? 'reserved' : status;
  return [line(t('label.item_code'), stock.item_code), line(t('label.barcode'), stock.barcode), line(t('label.warehouse'), stock.warehouse), line(t('label.quantity'), qty(stock.qty, stock.uom)),
    ...(stock.width_mm === null ? [] : [line(t('warehouse.roll_width'), qty(stock.width_mm, 'mm'))]),
    ...(stock.micron === null ? [] : [line(t('label.micron'), workerRawQuantity(stock.micron))]),
    ...(stock.length_m === null ? [] : [line(t('warehouse.roll_length'), qty(stock.length_m, 'm'))]),
    line(t('label.status'), ['available', 'reserved', 'in_use', 'consumed', 'returned', 'processed'].includes(statusKey) ? t(`stock.status.${statusKey}`) : statusKey),
    ...(includeReservation && dartTrim(stock.reserved_order_id) ? [line(t('calculate.order'), stock.reserved_order_id)] : []),
    ...(dartTrim(stock.source_receipt_id) ? [line(t('label.receipt'), stock.source_receipt_id)] : [])];
}
export function adminWarehouseMainItemRow(item: AdminWarehouseStockItem, index: number, t: Text): AdminWarehouseMainRow {
  return { kind: 'item', item, id: `item:${index}:${item.code}:${item.order_id}`, icon: 'item', title: dartTrim(item.name) ? item.name : item.code,
    subtitle: [dartTrim(item.order_id), dartTrim(item.code), qty(item.on_hand_qty, item.uom), dartTrim(item.item_group)].filter(Boolean).join(' • '), orderId: '',
    details: [line(t('label.code'), item.code), line(t('warehouse.available_quantity'), qty(item.on_hand_qty, item.uom)), line(t('warehouse.packages'), String(item.package_count)),
      ...(dartTrim(item.item_group) ? [line(t('label.group'), item.item_group)] : []), line(t('label.warehouse'), item.warehouse)] };
}
export function adminWarehouseMainQolipRow(group: AdminWarehouseMainQolipGroup, index: number, t: Text): AdminWarehouseMainRow {
  const title = group.name || group.code;
  return { kind: 'qolip', group, id: `qolip:${index}:${group.code}:${group.name}`, icon: 'qolip', title, orderId: '',
    subtitle: [group.code && group.code !== title ? group.code : '', `${group.qolips.length} ${dartPartialLower(t('label.item'))}`, group.itemGroup].filter(Boolean).join(' • '),
    details: [...(group.code ? [line(t('label.item_code'), group.code)] : []), ...(group.itemGroup ? [line(t('label.group'), group.itemGroup)] : []),
      ...group.qolips.map((product, position) => line(`${t('label.item')} ${position + 1}`, [dartTrim(product.qolip_code) || dartTrim(product.first_qolip_code),
        product.size > 0 ? `Razmer: ${product.size}` : '', dartTrim(product.color) ? `Rang: ${dartTrim(product.color)}` : '', product.is_in_use ? 'Holati: Ishlatilmoqda' : 'Holati: Mavjud'].filter(Boolean).join(' • ')))] };
}
export function adminWarehouseMainRawRow(stock: RawMaterialStock, index: number, t: Text, canQr: boolean, canEdit: boolean): AdminWarehouseMainRow {
  const title = dartTrim(stock.item_name) || dartTrim(stock.item_code) || stock.barcode;
  return { kind: 'raw', stock, canQr, canEdit, id: `raw:${index}:${stock.id}`, icon: 'raw', title, orderId: stock.reserved_order_id,
    subtitle: [dartTrim(stock.barcode), qty(stock.qty, stock.uom)].filter(Boolean).join(' • '), details: adminWarehouseMainRawLines(stock, t) };
}
function assignedDate(raw: string): string {
  const value = dartTrim(raw), date = parseDartDateTime(value); if (!date) return value;
  const two = (part: number) => String(part).padStart(2, '0'); return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
export function adminWarehouseMainReservationRows(reservations: readonly AdminRawMaterialAssignment[], stock: readonly RawMaterialStock[], apparatus: readonly AdminApparatus[], t: Text, production: Text, canQr: boolean): AdminWarehouseMainRow[] {
  const byBarcode = new Map(stock.map(row => [lower(row.barcode), row])), apparatusNames = new Map(apparatus.filter(row => dartTrim(row.id) && dartTrim(row.name)).map(row => [dartTrim(row.id), dartTrim(row.name)]));
  return reservations.map((reservation, index) => {
    const raw = byBarcode.get(lower(reservation.barcode)) ?? null, title = dartTrim(reservation.item_name) ? reservation.item_name : reservation.item_code;
    return { kind: 'reservation', reservation, stock: raw, canQr: canQr && raw !== null && !!dartTrim(raw.barcode), id: `reservation:${index}:${reservation.barcode}:${reservation.order_id}`, icon: 'reservation', title, orderId: reservation.order_id,
      subtitle: [dartTrim(reservation.item_code) !== dartTrim(title) ? dartTrim(reservation.item_code) : '', dartTrim(reservation.barcode), dartTrim(reservation.item_group)].filter(Boolean).join(' • '),
      details: [line(t('calculate.order'), reservation.order_id), ...(raw ? adminWarehouseMainRawLines(raw, t, false) : [line(t('label.item_code'), reservation.item_code), line(t('label.barcode'), reservation.barcode), line(t('label.quantity'), qty(reservation.stock_qty, reservation.stock_uom))]),
        ...(dartTrim(reservation.item_group) ? [line(t('label.group'), reservation.item_group)] : []), ...(dartTrim(reservation.apparatus) ? [line(t('label.apparatus'), apparatusNames.get(dartTrim(reservation.apparatus)) ?? dartTrim(reservation.apparatus))] : []),
        ...(dartTrim(reservation.assigned_by_name) ? [line(t('warehouse.reserved_by'), reservation.assigned_by_name)] : []), ...(dartTrim(reservation.assigned_at) ? [line(t('label.date'), assignedDate(reservation.assigned_at))] : []),
        ...(dartTrim(reservation.stock_status) ? [line(production('worker.material.balance'), production('worker.material.balance.summary', { received: qty(reservation.received_qty, reservation.stock_uom), used: qty(reservation.consumed_qty, reservation.stock_uom), remaining: qty(reservation.remaining_qty, reservation.stock_uom) }))] : [])] };
  });
}
