import type { DispatchRecord } from '../shared/notificationApi';
import type { CustomerSummary } from '../shared/dispatchRuntimeStores';
import { trimCustomerInput } from './customerLogic';
import type { CustomerStatusKind } from './customerStore';

export function customerStatusTitleKey(kind: CustomerStatusKind): string {
  switch (kind) {
    case 'pending': return 'pendingLabel';
    case 'confirmed': return 'confirmedStatus';
    case 'rejected': return 'rejectedLabel';
  }
}
export function customerStatusRows(summary: CustomerSummary): { kind: CustomerStatusKind; titleKey: string; count: number }[] {
  return [
    { kind: 'pending', titleKey: 'pendingLabel', count: summary.pendingCount },
    { kind: 'confirmed', titleKey: 'confirmedStatus', count: summary.confirmedCount },
    { kind: 'rejected', titleKey: 'rejectedLabel', count: summary.rejectedCount },
  ];
}
export function customerHomeRecord(record: DispatchRecord) {
  return { name: record.item_name, code: record.item_code, quantity: `${record.sent_qty.toFixed(0)} ${record.uom}` };
}
export function customerStatusRecord(record: DispatchRecord) {
  return { name: record.item_name, created: record.created_label, quantity: `${record.sent_qty.toFixed(0)} ${record.uom}`,
    note: trimCustomerInput(record.note) ? record.note : '' };
}
export function customerNotificationRecord(record: DispatchRecord): { name: string; code: string; created: string; body: string; icon: 'done' | 'close' | 'schedule' } {
  return { name: record.item_name, code: record.item_code, created: record.created_label,
    body: trimCustomerInput(record.note) ? record.note : `${record.sent_qty.toFixed(0)} ${record.uom} jo‘natildi`,
    icon: record.status === 'accepted' ? 'done' : record.status === 'rejected' ? 'close' : 'schedule' };
}
