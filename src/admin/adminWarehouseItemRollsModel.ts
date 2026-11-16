import type { AdminWarehouseStockRoll } from './warehouseStockApi';
import { workerRawQuantity } from '../workerPeremotka';
import { dartTrim } from './dartJsonString';
import type { AdminWarehouseMainDetailLine } from './AdminWarehouseMainRows';

export type AdminWarehouseItemRollRow = { key: string; roll: AdminWarehouseStockRoll; index: number; count: number; title: string; subtitle: string; details: readonly AdminWarehouseMainDetailLine[] };
type Text = (key: string) => string;
export function adminWarehouseItemRollRows(rolls: readonly AdminWarehouseStockRoll[], a: Text): AdminWarehouseItemRollRow[] {
  return rolls.map((roll, index) => {
    const qty = dartTrim(`${workerRawQuantity(roll.qty)} ${roll.uom}`), date = new Date(roll.accepted_at_unix * 1000), two = (value: number) => String(value).padStart(2, '0');
    const line = (key: string, value: string) => ({ label: a(key), value });
    return { key: `${index}:${roll.stock_id}:${roll.barcode}`, roll, index, count: rolls.length,
      title: dartTrim(roll.paddon_code) ? `Rulon ${index + 1} • Paddon ${roll.paddon_code}` : `Rulon ${index + 1}`,
      subtitle: [dartTrim(roll.barcode), qty, dartTrim(roll.order_id)].filter(Boolean).join(' • '),
      details: [line('label.barcode', roll.barcode), line('calculate.order', roll.order_id), line('warehouse.available_quantity', qty),
        ...(dartTrim(roll.paddon_code) ? [line('warehouse.paddon', roll.paddon_code)] : []), ...(dartTrim(roll.progress_batch_id) ? [line('warehouse.progress_batch', roll.progress_batch_id)] : []),
        ...(dartTrim(roll.accepted_by_display_name) ? [line('warehouse.accepted_by', roll.accepted_by_display_name)] : []),
        ...(roll.accepted_at_unix > 0 ? [line('label.date', `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`)] : [])] };
  });
}
