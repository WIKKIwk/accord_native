import type { WerkaSummary } from '../shared/dispatchRuntimeStores';
import { localizedGetter } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';
import type { WerkaStatusKind } from './werkaRecordApi';

export type WerkaHomeContentProps = {
  locale: string; loading: boolean; loaded: boolean; error: unknown | null; summary: WerkaSummary;
  pending: readonly DispatchRecord[]; expanded: boolean; onRefresh: () => Promise<void>; onToggle: () => void;
  onOpenStatus: (kind: WerkaStatusKind) => void;
  onOpenRecord: (record: DispatchRecord, target: 'customerDeliveryDetail' | 'detail') => void;
};
export function werkaHomeStatusRows(summary: WerkaSummary, locale: string) {
  return [
    { kind: 'pending' as const, title: localizedGetter('pendingStatus', locale), count: summary.pendingCount },
    { kind: 'confirmed' as const, title: localizedGetter('confirmedStatus', locale), count: summary.confirmedCount },
    { kind: 'returned' as const, title: localizedGetter('returnedStatus', locale), count: summary.returnedCount },
  ];
}
export function werkaHomeRecordTarget(record: DispatchRecord): 'customerDeliveryDetail' | 'detail' {
  return record.record_type === 'delivery_note' || record.event_type.startsWith('customer_delivery_') ? 'customerDeliveryDetail' : 'detail';
}
export function werkaHomeQuantity(record: DispatchRecord): string {
  const qty = Object.is(record.sent_qty, -0) ? '-0' : record.sent_qty.toFixed(0);
  return `${qty} ${record.uom}`;
}
