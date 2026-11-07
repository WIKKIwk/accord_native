import { preparationHistoryDate } from './preparationHistoryModel';
import { preparationDisplay } from './preparationModel';
import type { MaterialStockRow, MaterialStockTab } from './preparationMaterialStockApi';

export const materialStockTabLabels: Record<MaterialStockTab, string> = { available: 'Mavjud', receipts: 'Kirim', issues: 'Chiqim' };
const events: Record<string, string> = { receipt_posted: 'Kirim', consumption_posted: 'Sarf', transfer_in: 'Transfer kirimi', transfer_out: 'Transfer chiqimi',
  adjustment_increase: 'Qoldiq qo‘shildi', adjustment_decrease: 'Qoldiq kamaytirildi', stock_corrected: 'Qoldiq tuzatildi', stock_deleted: 'Kirim o‘chirildi',
  split_consumed: 'Kesishga sarflandi', split_produced: 'Kesilgan homashyo kirimi', consumption_reversed: 'Sarf qaytarildi', layer_remainder_returned: 'Qoldiq qaytarildi' };

export function materialStockRowPresentation(row: MaterialStockRow, tab: MaterialStockTab, t: (value: string) => string) {
  const dimension = (value: string | null, unit: string) => value && Number(value) > 0 ? `${preparationDisplay(value)} ${unit}` : '';
  const dimensions = [dimension(row.width_mm, 'mm'), dimension(row.micron, 'μm')].filter(Boolean).join(' · ');
  const length = dimension(row.length_m, 'm');
  const event = t(events[row.event_type] ?? materialStockTabLabels[tab]);
  const code = row.has_qr && row.barcode ? row.barcode : '';
  const shortCode = code.length > 8 ? `…${code.slice(-8)}` : code;
  const fullDate = preparationHistoryDate(row.created_at);
  const date = fullDate.replace(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}):\d{2}$/, '$3.$2.$1 $4');
  const title = tab === 'available' ? dimensions || t('O‘lcham kiritilmagan')
    : row.order_code ? `${t('Buyurtma')} №${row.order_code}` : event;
  const middle = tab === 'available' ? length ? `${t('Uzunligi')}: ${length}` : ''
    : [row.actor_name, row.order_code && event !== t('Kirim') ? event : ''].filter(Boolean).join(' · ');
  const detail = [middle, [date, shortCode ? `${t('Kod')}: ${shortCode}` : ''].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
  const amount = `${tab === 'receipts' ? '+' : tab === 'issues' ? '−' : ''}${preparationDisplay(row.kg)} kg`;
  const fullDetails = [title, amount, tab === 'available' && length ? `${t('Uzunligi')}: ${length}` : '',
    tab !== 'available' && row.order_code ? event : '', tab !== 'available' && row.actor_name ? `${t('Mas’ul')}: ${row.actor_name}` : '',
    fullDate, code ? `${t('Kod')}: ${code}` : t('Kod mavjud emas')].filter(Boolean).join('\n');
  return { title, detail, amount, fullDetails };
}
