import type { CustomerReturnInput } from './customerLogic';
import type { DispatchRecord } from '../shared/notificationApi';

export type CustomerReturnKind = 'reject' | 'partial' | 'claim';
export type CustomerReturnDialogProps = { kind: CustomerReturnKind | null; sentQty: number; uom: string;
  onCancel: () => void; onConfirm: (input: CustomerReturnInput) => void };
export function customerReturnTitleKey(kind: CustomerReturnKind): string {
  return kind === 'reject' ? 'rejectTitle' : kind === 'partial' ? 'partialAcceptTitle' : 'reportIssueTitle';
}
export function customerDeliveryStatusKey(status: DispatchRecord['status']): string {
  switch (status) {
    case 'accepted': return 'approvedLabel';
    case 'partial': return 'partiallyCompleted';
    case 'rejected': return 'rejectedStatusLabel';
    default: return 'pendingLabel';
  }
}

export type CustomerDeliveryInfoRow = { labelKey: string; label: string; value: string; highlighted: boolean };

/** Read-only CustomerDeliveryDetailScreen rows, including _DetailLine's exact label comparison. */
export function customerDeliveryInfoRows(record: DispatchRecord, text: (key: string) => string): CustomerDeliveryInfoRow[] {
  const row = (labelKey: string, value: string): CustomerDeliveryInfoRow => {
    const label = text(labelKey);
    return { labelKey, label, value, highlighted: label === 'Status' };
  };
  return [
    row('customerLabel', record.supplier_name),
    row('itemLabel', `${record.item_code} • ${record.item_name}`),
    row('pendingStatus', `${record.sent_qty.toFixed(2)} ${record.uom}`),
    ...(record.accepted_qty > 0 ? [row('acceptedFromQtyPrefix', `${record.accepted_qty.toFixed(2)} ${record.uom}`)] : []),
    row('statusLabel', text(customerDeliveryStatusKey(record.status))),
  ];
}

export function customerDiscussionEventId(deliveryNoteID: string): string {
  return `customer_delivery_result:${deliveryNoteID.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '')}`;
}
