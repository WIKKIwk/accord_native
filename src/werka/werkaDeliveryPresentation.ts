import { localizedGetter, localizedMethod } from '../shared/localization';
import type { DispatchRecord } from '../shared/notificationApi';

export type WerkaDeliveryContentProps = { record: DispatchRecord; locale: string };
/** Two-decimal variant of the V2 quantity formatter used by this surface. */
export function werkaDeliveryQuantity(value: number): string {
  if (Object.is(value, -0)) return '-0';
  return value.toFixed(Number.isInteger(value) ? 0 : 2);
}
export function werkaDeliveryPresentation({ record, locale }: WerkaDeliveryContentProps) {
  const t = (key: string) => localizedGetter(key, locale);
  const statusKey = { accepted: 'customerApproved', rejected: 'customerRejected', partial: 'partiallyCompleted',
    cancelled: 'cancelled', pending: 'waitingCustomerResponse', draft: 'draft' }[record.status];
  const status = t(statusKey), note = record.note.trim();
  const rows = [{ label: t('itemLabel'), value: record.item_name },
    { label: t('pendingStatus'), value: `${werkaDeliveryQuantity(record.sent_qty)} ${record.uom}` },
    ...(record.accepted_qty > 0 ? [{ label: t('confirmedStatus'), value: `${werkaDeliveryQuantity(record.accepted_qty)} ${record.uom}` }] : []),
    { label: t('statusLabel'), value: status }, { label: t('dateLabel'), value: record.created_label }];
  return { title: t('customerShipmentTitle'), supplier: record.supplier_name, status, rows,
    noteTitle: t('detailsStateTitle'), note: note || (record.status === 'pending'
      ? localizedMethod('customerShipmentPendingNote', locale, {}) : t('noExtraNote')),
    discussionHeld: record.status === 'accepted' || record.status === 'rejected' };
}
