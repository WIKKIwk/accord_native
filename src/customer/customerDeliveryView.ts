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
export function customerDiscussionEventId(deliveryNoteID: string): string {
  return `customer_delivery_result:${deliveryNoteID.replace(/^[\s\u0085]+|[\s\u0085]+$/g, '')}`;
}
