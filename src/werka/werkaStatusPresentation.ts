import { localizedGetter, localizedMethod } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';
import { werkaHomeQuantity, werkaHomeRecordTarget } from './werkaHomePresentation';
import type { WerkaStatusBreakdownEntry, WerkaStatusKind } from './werkaRecordApi';

type Common = { locale: string; kind: WerkaStatusKind; loading: boolean; error: unknown | null; onRefresh: () => Promise<void> };
export type WerkaStatusContentProps = Common & (
  | { mode: 'breakdown'; items: readonly WerkaStatusBreakdownEntry[]; onOpen: (entry: WerkaStatusBreakdownEntry) => void }
  | { mode: 'detail'; items: readonly DispatchRecord[];
      onOpen: (record: DispatchRecord, target: 'customerDeliveryDetail' | 'detail' | 'notificationDetail') => void }
);
export function werkaBreakdownPresentation(entry: WerkaStatusBreakdownEntry, kind: WerkaStatusKind, locale: string) {
  const status = localizedGetter(kind === 'pending' ? 'pendingStatus' : kind === 'confirmed' ? 'confirmedStatus' : 'returnedStatus', locale);
  const qty = kind === 'pending' ? entry.totalSentQty : kind === 'confirmed' ? entry.totalAcceptedQty : entry.totalReturnedQty;
  const metric = localizedMethod('sentQtyStatus', locale, { qty, uom: entry.uom, statusWord: status.toLowerCase() });
  return { title: entry.supplierName, subtitle: localizedMethod('recordCountLabel', locale, { count: entry.receiptCount }),
    trailing: Object.is(qty, -0) && metric.startsWith('0 ') ? `-${metric}` : metric };
}
export function werkaDetailPresentation(record: DispatchRecord, locale: string) {
  const title = record.item_name.trim() ? record.item_name : record.item_code;
  const subtitle = record.note.trim() ? record.note : record.accepted_qty > 0
    ? localizedMethod('acceptedQtyLabel', locale, { qty: record.accepted_qty, uom: record.uom }) : '';
  return { title, subtitle, trailing: werkaHomeQuantity(record), date: record.created_label };
}
export function werkaStatusRecordTarget(record: DispatchRecord, kind: WerkaStatusKind): 'customerDeliveryDetail' | 'detail' | 'notificationDetail' {
  if (werkaHomeRecordTarget(record) === 'customerDeliveryDetail') return 'customerDeliveryDetail';
  return kind === 'pending' ? 'detail' : 'notificationDetail';
}
