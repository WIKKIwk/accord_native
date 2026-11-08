import type { Session } from '../auth';
import { werkaHomeFromJson } from '../authenticateAccount';
import { authorizedFetch } from '../authorizedFetch';
import { dispatchRecordFromJson, type DispatchRecord } from '../shared/notificationApi';

type Obj = Record<string, unknown>;
export type WerkaStatusKind = 'pending' | 'confirmed' | 'returned';
export type WerkaStatusBreakdownEntry = { supplierRef: string; supplierName: string; receiptCount: number;
  totalSentQty: number; totalAcceptedQty: number; totalReturnedQty: number; uom: string };
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Werka object');
  return value as Obj;
};
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid Werka string');
  return value;
};
const number = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid Werka number');
  return value;
};
const integer = (value: unknown): number => {
  if (value == null) return 0;
  if (!Number.isInteger(value)) throw new TypeError('Invalid Werka integer');
  return value as number;
};
async function list(response: Response, error: string): Promise<unknown[]> {
  if (response.status !== 200) throw new Error(error);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new TypeError('Invalid Werka list');
  return data;
}
async function records(response: Response, error: string): Promise<DispatchRecord[]> {
  return (await list(response, error)).map(dispatchRecordFromJson);
}

/** @v2 WerkaStatusBreakdownEntry */
export function werkaStatusBreakdownEntryFromJson(value: unknown): WerkaStatusBreakdownEntry {
  const row = object(value);
  return { supplierRef: string(row.supplier_ref), supplierName: string(row.supplier_name), receiptCount: integer(row.receipt_count),
    totalSentQty: number(row.total_sent_qty), totalAcceptedQty: number(row.total_accepted_qty),
    totalReturnedQty: number(row.total_returned_qty), uom: string(row.uom) };
}

/** @v2 werkaPending */
export async function werkaPending(session: Session): Promise<DispatchRecord[]> {
  return records(await authorizedFetch(session, '/v1/mobile/werka/pending'), 'Werka pending failed');
}

/** @v2 werkaSummary */
export async function werkaSummary(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/werka/summary');
  if (response.status !== 200) throw new Error('Werka summary failed');
  return werkaHomeFromJson({ summary: object(await response.json()) }).summary;
}

/** @v2 werkaStatusBreakdown */
export async function werkaStatusBreakdown(session: Session, kind: WerkaStatusKind): Promise<WerkaStatusBreakdownEntry[]> {
  const query = new URLSearchParams({ kind });
  return (await list(await authorizedFetch(session, `/v1/mobile/werka/status-breakdown?${query}`), 'Werka status breakdown failed'))
    .map(werkaStatusBreakdownEntryFromJson);
}

/** @v2 werkaStatusDetails */
export async function werkaStatusDetails(session: Session, kind: WerkaStatusKind, supplierRef: string): Promise<DispatchRecord[]> {
  const query = new URLSearchParams({ kind, supplier_ref: supplierRef });
  return records(await authorizedFetch(session, `/v1/mobile/werka/status-details?${query}`), 'Werka status details failed');
}

/** @v2 werkaHistory */
export async function werkaHistory(session: Session): Promise<DispatchRecord[]> {
  return records(await authorizedFetch(session, '/v1/mobile/werka/history'), 'Werka history failed');
}

/** @v2 werkaNotifications */
export async function werkaNotifications(session: Session): Promise<DispatchRecord[]> {
  return records(await authorizedFetch(session, '/v1/mobile/werka/notifications'), 'Werka notifications failed');
}

/** @v2 confirmReceipt */
export async function confirmReceipt(session: Session, input: { receiptID: string; acceptedQty: number; returnedQty?: number;
  returnReason?: string; returnComment?: string }): Promise<DispatchRecord> {
  const response = await authorizedFetch(session, '/v1/mobile/werka/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt_id: input.receiptID, accepted_qty: input.acceptedQty, returned_qty: input.returnedQty ?? 0,
      return_reason: input.returnReason ?? '', return_comment: input.returnComment ?? '' }) });
  if (response.status !== 200) throw new Error('Confirm receipt failed');
  return dispatchRecordFromJson(await response.json());
}
