import { localizedGetter } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';

export type WerkaNotificationRowsProps = {
  items: readonly DispatchRecord[];
  /** Supplied by a future account-safe source; this component does not infer or subscribe to unread state. */
  highlightedIds: ReadonlySet<string>;
  locale: string;
  /** Supplied only by a future account-safe owner; no store is connected here. */
  onRefresh: () => Promise<void>;
};
function fixedZero(value: number): string { return Object.is(value, -0) ? '-0' : value.toFixed(0); }
export function werkaNotificationPresentation(record: DispatchRecord, locale: string) {
  const expected = `${fixedZero(record.sent_qty)} ${record.uom}`;
  return { title: record.event_type === 'supplier_ack' ? localizedGetter('supplierAckTitle', locale)
      : record.status === 'pending' ? record.supplier_name : record.item_code,
    secondary: record.highlight.trim() ? record.highlight : record.item_name,
    metric: record.accepted_qty <= 0 ? `${expected} qabul kutmoqda`
      : `${fixedZero(record.accepted_qty)} ${record.uom} qabul qilindi • ${expected} kutilgan`,
    date: record.created_label,
    icon: record.status };
}
export function orderedWerkaNotifications(items: readonly DispatchRecord[], highlightedIds: ReadonlySet<string>): DispatchRecord[] {
  return [...items.filter(item => highlightedIds.has(item.id)), ...items.filter(item => !highlightedIds.has(item.id))];
}
