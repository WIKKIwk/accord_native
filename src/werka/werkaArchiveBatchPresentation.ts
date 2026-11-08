import type { CustomerDirectoryEntry, CustomerItemOption, WerkaArchiveBatchQrPayload } from './werkaArchiveBatchQr';
import { werkaDeliveryQuantity } from './werkaDeliveryPresentation';
import { werkaBatchTrim } from './werkaBatchTrim';

export type WerkaArchiveBatchContentProps = { payload: WerkaArchiveBatchQrPayload } & (
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'resolved'; option: CustomerItemOption; customer: CustomerDirectoryEntry }
);
/** V2 uses formatQuantity with two decimals and trailing-zero removal. */
export function werkaArchiveBatchQuantity(value: number): string {
  const result = werkaDeliveryQuantity(value);
  return result.includes('.') && !result.includes('e') ? result.replace(/0+$/, '').replace(/\.$/, '') : result;
}
export function werkaArchiveBatchPresentation(props: WerkaArchiveBatchContentProps) {
  const { payload } = props;
  const title = props.state === 'loading' ? payload.itemName : props.state === 'missing' ? 'Mahsulot topilmadi' : props.option.itemName;
  const subtitle = props.state === 'loading' ? 'Mahsulot customer ro‘yxatidan qidirilmoqda...'
    : props.state === 'missing' ? 'Batch QR ichidagi mahsulot customer jo‘natish ro‘yxatidan topilmadi.' : props.customer.name;
  const rows = [{ label: 'Netto', value: `${werkaArchiveBatchQuantity(payload.nettoQty)} Kg` },
    { label: 'Brutto', value: `${werkaArchiveBatchQuantity(payload.bruttoQty)} Kg` },
    ...(werkaBatchTrim(payload.batchTime) ? [{ label: 'Sana', value: payload.batchTime }] : []),
    ...(props.state === 'resolved' ? [{ label: 'Kod', value: props.option.itemCode }, { label: 'Haridor', value: props.customer.name },
      ...(werkaBatchTrim(props.option.warehouse) ? [{ label: 'Ombor', value: props.option.warehouse }] : [])] : [])];
  return { title, subtitle, rows, shellTitle: 'Batch QR', shellSubtitle: werkaBatchTrim(payload.itemName) || 'Batch tafsiloti' };
}
