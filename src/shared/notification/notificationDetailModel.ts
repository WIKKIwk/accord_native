import type { DispatchRecord, NotificationDetail } from '../notificationApi';

export type NotificationRole = 'supplier' | 'customer' | 'werka' | string | null;

/** Dart VM String.trim, used by the V2 notification detail forms and ownership check. */
export function trimNotificationText(value: string): string {
  return value.replace(/^[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$/g, '');
}

/** V2 sends customer delivery-note IDs directly to the customer detail screen. */
export function notificationCustomerRedirect(role: NotificationRole, receiptId: string): boolean {
  return role === 'customer' && receiptId.startsWith('MAT-DN-');
}

export function notificationRoleHasDock(role: NotificationRole): boolean {
  return role === 'supplier' || role === 'werka';
}

export function notificationStatusLabel(status: DispatchRecord['status']): string {
  switch (status) {
    case 'pending': return 'Kutilmoqda';
    case 'accepted': return 'Qabul qilindi';
    case 'partial': return 'Qisman qabul';
    case 'rejected': return 'Rad etildi';
    case 'cancelled': return 'Bekor qilindi';
    case 'draft': return 'Draft';
  }
}

/** Rules from NotificationDetailScreen; exposed independently from both native views. */
export function notificationDetailPolicy(role: NotificationRole, profileRef: string, detail: NotificationDetail) {
  const record = detail.record;
  const supplierRef = trimNotificationText(record.supplier_ref);
  const belongs = role !== 'supplier' || !supplierRef || supplierRef === trimNotificationText(profileRef);
  const canConfirm = role === 'werka' && !record.event_type && (record.status === 'pending' || record.status === 'draft');
  const canRespond = role === 'supplier' && record.event_type === 'werka_unannounced_pending';
  const supplierAcknowledged = detail.comments.some(comment =>
    comment.author_label.startsWith('Supplier') && comment.body.toLowerCase().includes('tasdiqlayman'));
  const issue = !!trimNotificationText(record.note) || ['partial', 'rejected', 'cancelled'].includes(record.status);
  const canAcknowledge = role === 'supplier' && !canRespond && !supplierAcknowledged && issue;
  const canWriteIssueComment = issue && !canRespond && record.event_type !== 'supplier_ack'
    && !(role === 'supplier' && supplierAcknowledged);
  return { belongs, canConfirm, canRespond, supplierAcknowledged, canAcknowledge, canWriteIssueComment,
    showHighlight: record.event_type === 'supplier_ack' && !!trimNotificationText(record.highlight) };
}

/** A reachable Werka action must never silently turn into a no-op. */
export function notificationWerkaAction(policy: { canConfirm: boolean }, record: DispatchRecord,
  onWerkaDetail?: (record: DispatchRecord) => void): (() => void) | null {
  if (!policy.canConfirm) return null;
  if (!onWerkaDetail) throw new Error('Werka detail destination is unavailable');
  return () => onWerkaDetail(record);
}
