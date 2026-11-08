import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { dispatchRecordFromJson } from '../shared/notificationApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid customer issue string');
  return value;
};
const number = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid customer issue quantity');
  return value;
};
const list = (value: unknown): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid customer issue list');
  return value;
};
const jsonHeaders = { 'Content-Type': 'application/json' };

/** @v2 WerkaCustomerIssueRecord */
export function werkaCustomerIssueRecordFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid customer issue');
  return { entryID: string(row.entry_id), customerRef: string(row.customer_ref), customerName: string(row.customer_name),
    itemCode: string(row.item_code), itemName: string(row.item_name), uom: string(row.uom), qty: number(row.qty),
    createdLabel: string(row.created_label) };
}

/** @v2 WerkaCustomerIssueBatchLineResult */
export function werkaCustomerIssueBatchLineResultFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid customer issue batch line');
  return { lineIndex: Math.trunc(number(row.line_index)), record: object(row.record) ? werkaCustomerIssueRecordFromJson(row.record) : null,
    error: string(row.error), errorCode: string(row.error_code) };
}

/** @v2 WerkaCustomerIssueBatchResult */
export function werkaCustomerIssueBatchResultFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid customer issue batch');
  return { clientBatchID: string(row.client_batch_id), created: list(row.created).map(werkaCustomerIssueBatchLineResultFromJson),
    failed: list(row.failed).map(werkaCustomerIssueBatchLineResultFromJson) };
}

/** @v2 createWerkaUnannouncedDraft */
export async function createWerkaUnannouncedDraft(session: Session, input: { supplierRef: string; itemCode: string; qty: number }) {
  const response = await authorizedFetch(session, '/v1/mobile/werka/unannounced/create', { method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ supplier_ref: input.supplierRef, item_code: input.itemCode, qty: input.qty }) });
  if (response.status !== 200) throw new Error('Werka unannounced create failed');
  return dispatchRecordFromJson(await response.json());
}

/** @v2 createWerkaCustomerIssue */
export async function createWerkaCustomerIssue(session: Session, input: { customerRef: string; itemCode: string; qty: number;
  sourceBarcode?: string; sourceStockEntryName?: string; sourceLineIndex?: number }) {
  const body: Obj = { customer_ref: input.customerRef, item_code: input.itemCode, qty: input.qty };
  if (input.sourceBarcode?.trim()) body.source_barcode = input.sourceBarcode.trim();
  if (input.sourceStockEntryName?.trim()) body.source_stock_entry = input.sourceStockEntryName.trim();
  if ((input.sourceLineIndex ?? 0) > 0) body.source_line_index = input.sourceLineIndex;
  const response = await authorizedFetch(session, '/v1/mobile/werka/customer-issue/create', { method: 'POST', headers: jsonHeaders,
    body: JSON.stringify(body) });
  if (response.status !== 200) {
    let raw: unknown;
    try { raw = await response.json(); } catch { raw = null; }
    const code = string(object(raw)?.error_code).trim();
    if (code === 'insufficient_stock') throw new MobileApiException({ code, message: 'Insufficient stock', statusCode: 409 });
    if (code === 'duplicate_customer_issue_source') throw new MobileApiException({ code, message: 'QR already dispatched', statusCode: 409 });
    throw new Error('Werka customer issue create failed');
  }
  return werkaCustomerIssueRecordFromJson(await response.json());
}

/** @v2 createWerkaCustomerIssueBatch */
export async function createWerkaCustomerIssueBatch(session: Session, clientBatchID: string,
  lines: readonly { customerRef: string; itemCode: string; qty: number }[]) {
  const response = await authorizedFetch(session, '/v1/mobile/werka/customer-issue/batch-create', { method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ client_batch_id: clientBatchID,
      lines: lines.map(line => ({ customer_ref: line.customerRef, item_code: line.itemCode, qty: line.qty })) }) });
  if (response.status !== 200) throw new Error('Werka customer issue batch create failed');
  return werkaCustomerIssueBatchResultFromJson(await response.json());
}
