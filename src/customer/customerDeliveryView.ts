import type { CustomerReturnInput } from './customerLogic';
import type { DispatchRecord } from '../shared/notificationApi';
import type { CustomerDeliveryDetail } from './customerApi';

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

export type CustomerDeliveryResponseAction = { kind: 'approve' | CustomerReturnKind; labelKey: string;
  appearance: 'filled' | 'tonal' | 'outlined'; spacingBefore: 0 | 12 };

/** Source action order/emphasis and conditional spacers; V2 adds no spacer before claim. */
export function customerDeliveryResponseActions(detail: Pick<CustomerDeliveryDetail,
  'canApprove' | 'canPartiallyAccept' | 'canReject' | 'canReportClaim'>, submitting: boolean): CustomerDeliveryResponseAction[] {
  const actions: CustomerDeliveryResponseAction[] = [];
  if (detail.canApprove) actions.push({ kind: 'approve', labelKey: submitting ? 'sending' : 'approveAction', appearance: 'filled', spacingBefore: 0 });
  if (detail.canPartiallyAccept) actions.push({ kind: 'partial', labelKey: 'partialAcceptAction', appearance: 'tonal', spacingBefore: detail.canApprove ? 12 : 0 });
  if (detail.canReject) actions.push({ kind: 'reject', labelKey: 'rejectAction', appearance: 'outlined',
    spacingBefore: detail.canApprove || detail.canPartiallyAccept ? 12 : 0 });
  if (detail.canReportClaim) actions.push({ kind: 'claim', labelKey: 'reportIssueAction', appearance: 'tonal', spacingBefore: 0 });
  return actions;
}

export function customerDiscussionEventId(deliveryNoteID: string): string {
  return `customer_delivery_result:${deliveryNoteID.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '')}`;
}
