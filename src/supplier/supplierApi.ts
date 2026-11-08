import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import type { SupplierSummary } from '../shared/dispatchRuntimeStores';
import { dispatchRecordFromJson, type DispatchRecord } from '../shared/notificationApi';

export type SupplierStatusKind = 'pending' | 'submitted' | 'returned';
export type SupplierStatusBreakdownEntry = {
  item_code: string;
  item_name: string;
  receipt_count: number;
  total_sent_qty: number;
  total_accepted_qty: number;
  total_returned_qty: number;
  uom: string;
};

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid supplier object');
  return value as JsonObject;
}
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid supplier string');
  return value;
}
function number(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid supplier number');
  return value;
}
function integer(value: unknown): number {
  const result = number(value);
  if (!Number.isInteger(result)) throw new TypeError('Invalid supplier integer');
  return result;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid supplier list');
  return value;
}

/** Preserve Dart Exception's visible prefix for the source's explicit failures. */
export class SupplierApiException extends Error {
  toString(): string { return `Exception: ${this.message}`; }
}

/** @v2 SupplierHomeSummary.fromJson */
export function supplierSummaryFromJson(value: unknown): SupplierSummary {
  const row = object(value);
  return { pendingCount: integer(row.pending_count), submittedCount: integer(row.submitted_count),
    returnedCount: integer(row.returned_count) };
}

/** @v2 SupplierStatusBreakdownEntry.fromJson */
export function supplierStatusBreakdownEntryFromJson(value: unknown): SupplierStatusBreakdownEntry {
  const row = object(value);
  return { item_code: text(row.item_code), item_name: text(row.item_name), receipt_count: integer(row.receipt_count),
    total_sent_qty: number(row.total_sent_qty), total_accepted_qty: number(row.total_accepted_qty),
    total_returned_qty: number(row.total_returned_qty), uom: text(row.uom) };
}

/** @v2 supplierHistory */
export async function supplierHistory(session: Session): Promise<DispatchRecord[]> {
  const response = await authorizedFetch(session, '/v1/mobile/supplier/history');
  if (response.status !== 200) throw new SupplierApiException('Supplier history failed');
  return list(await response.json()).map(dispatchRecordFromJson);
}

/** @v2 supplierSummary */
export async function supplierSummary(session: Session): Promise<SupplierSummary> {
  const response = await authorizedFetch(session, '/v1/mobile/supplier/summary');
  if (response.status !== 200) throw new SupplierApiException('Supplier summary failed');
  return supplierSummaryFromJson(await response.json());
}

/** @v2 supplierStatusBreakdown */
export async function supplierStatusBreakdown(session: Session, kind: SupplierStatusKind): Promise<SupplierStatusBreakdownEntry[]> {
  const query = new URLSearchParams({ kind });
  const response = await authorizedFetch(session, `/v1/mobile/supplier/status-breakdown?${query}`);
  if (response.status !== 200) throw new SupplierApiException('Supplier status breakdown failed');
  return list(await response.json()).map(supplierStatusBreakdownEntryFromJson);
}

/** @v2 supplierStatusDetails */
export async function supplierStatusDetails(session: Session, kind: SupplierStatusKind, itemCode: string): Promise<DispatchRecord[]> {
  const query = new URLSearchParams({ kind, item_code: itemCode });
  const response = await authorizedFetch(session, `/v1/mobile/supplier/status-details?${query}`);
  if (response.status !== 200) throw new SupplierApiException('Supplier status details failed');
  return list(await response.json()).map(dispatchRecordFromJson);
}

// The V2 test-mode branch is deferred until the shared test-mode pass (D3).
export async function supplierItems(session: Session, query = ''): Promise<SupplierItem[]> {
  const suffix = query.trim() ? `?${new URLSearchParams({ q: query })}` : '';
  const response = await authorizedFetch(session, `/v1/mobile/supplier/items${suffix}`);
  if (response.status !== 200) throw new SupplierApiException('Supplier items failed');
  return list(await response.json()).map(supplierItemFromJson);
}

/** @v2 createDispatch */
export async function createDispatch(session: Session, itemCode: string, qty: number): Promise<DispatchRecord> {
  // Dart's jsonEncode rejects NaN and infinities instead of emitting JSON null.
  if (!Number.isFinite(qty)) throw new TypeError('Invalid dispatch quantity');
  const response = await authorizedFetch(session, '/v1/mobile/supplier/dispatch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_code: itemCode, qty }),
  });
  if (response.status !== 200) throw new SupplierApiException('Dispatch create failed');
  return dispatchRecordFromJson(await response.json());
}
