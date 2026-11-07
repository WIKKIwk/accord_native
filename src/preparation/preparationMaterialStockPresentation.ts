import { preparationHistoryDate } from './preparationHistoryModel';
import { preparationDisplay } from './preparationModel';
import type { MaterialStockRow, MaterialStockTab } from './preparationMaterialStockApi';

export const materialStockTabLabels: Record<MaterialStockTab, string> = { available: 'Mavjud', receipts: 'Kirim', issues: 'Chiqim' };
const events: Record<string, string> = { receipt_posted: 'Kirim', consumption_posted: 'Sarf', transfer_in: 'Transfer kirimi', transfer_out: 'Transfer chiqimi',
  adjustment_increase: 'Qoldiq qo‘shildi', adjustment_decrease: 'Qoldiq kamaytirildi', stock_corrected: 'Qoldiq tuzatildi', stock_deleted: 'Kirim o‘chirildi',
  split_consumed: 'Kesishga sarflandi', split_produced: 'Kesilgan homashyo kirimi', consumption_reversed: 'Sarf qaytarildi', layer_remainder_returned: 'Qoldiq qaytarildi' };
export function materialStockRowPresentation(row: MaterialStockRow, tab: MaterialStockTab, t: (value: string) => string) {
  const title = tab === 'available' ? row.has_qr ? row.barcode : t('QR’siz kirim') : t(events[row.event_type] ?? materialStockTabLabels[tab]);
  const dimension = (value: string | null, unit: string) => value && Number(value) > 0 ? `${preparationDisplay(value)} ${unit}` : '';
  const dimensions = [dimension(row.width_mm, 'mm'), dimension(row.micron, 'μm'), dimension(row.length_m, 'm')].filter(Boolean).join(' · ');
  const detail = [tab !== 'available' && row.has_qr ? row.barcode : '', preparationHistoryDate(row.created_at), dimensions,
    row.actor_name, row.order_code ? `${t('Buyurtma')}: ${row.order_code}` : ''].filter(Boolean).join(' · ');
  return { title, detail, amount: `${tab === 'receipts' ? '+' : tab === 'issues' ? '−' : ''}${preparationDisplay(row.kg)} kg` };
}
