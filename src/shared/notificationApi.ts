import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';

type ObjectValue = Record<string, unknown>;
export type DispatchRecord = {
  id: string; record_type: string; supplier_ref: string; supplier_name: string;
  item_code: string; item_name: string; uom: string; sent_qty: number; accepted_qty: number;
  amount: number; currency: string; note: string; event_type: string; highlight: string;
  status: 'draft' | 'pending' | 'accepted' | 'partial' | 'rejected' | 'cancelled'; created_label: string;
};
export type NotificationComment = { id: string; author_label: string; body: string; created_label: string };
export type NotificationDetail = { record: DispatchRecord; comments: NotificationComment[] };

function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid notification object');
  return value as ObjectValue;
}
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid notification string');
  return value;
}
function number(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid notification number');
  return value;
}
function parseDetail(value: unknown): NotificationDetail {
  const source = object(value);
  const record = source.record == null ? {} : object(source.record);
  const rawStatus = text(record.status).trim().toLowerCase();
  const status = (['accepted', 'partial', 'rejected', 'cancelled', 'draft'].includes(rawStatus)
    ? rawStatus : 'pending') as DispatchRecord['status'];
  if (source.comments != null && !Array.isArray(source.comments)) throw new TypeError('Invalid notification comments');
  const comments = (source.comments ?? []) as unknown[];
  return {
    record: {
      id: text(record.id), record_type: text(record.record_type), supplier_ref: text(record.supplier_ref),
      supplier_name: text(record.supplier_name), item_code: text(record.item_code), item_name: text(record.item_name),
      uom: text(record.uom), sent_qty: number(record.sent_qty), accepted_qty: number(record.accepted_qty),
      amount: number(record.amount), currency: text(record.currency), note: text(record.note),
      event_type: text(record.event_type), highlight: text(record.highlight), status,
      created_label: text(record.created_label),
    },
    comments: comments.map(item => {
      const comment = object(item);
      return { id: text(comment.id), author_label: text(comment.author_label), body: text(comment.body),
        created_label: text(comment.created_label) };
    }),
  };
}

/** @v2 notificationDetail */
export async function notificationDetail(session: Session, receiptId: string): Promise<NotificationDetail> {
  const query = new URLSearchParams({ receipt_id: receiptId });
  const response = await authorizedFetch(session, `/v1/mobile/notifications/detail?${query}`);
  if (response.status !== 200) throw new Error('Notification detail failed');
  return parseDetail(await response.json());
}

/** @v2 addNotificationComment */
export async function addNotificationComment(session: Session, receiptId: string, message: string): Promise<NotificationDetail> {
  const query = new URLSearchParams({ receipt_id: receiptId });
  const response = await authorizedFetch(session, `/v1/mobile/notifications/comments?${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
  });
  if (response.status !== 200) throw new Error('Notification comment failed');
  return parseDetail(await response.json());
}

/** @v2 supplierRespondUnannounced */
export async function supplierRespondUnannounced(session: Session, receiptId: string, approve: boolean, reason = ''): Promise<NotificationDetail> {
  const response = await authorizedFetch(session, '/v1/mobile/supplier/unannounced/respond', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt_id: receiptId, approve, reason }),
  });
  if (response.status !== 200) throw new Error('Supplier unannounced response failed');
  return parseDetail(await response.json());
}
