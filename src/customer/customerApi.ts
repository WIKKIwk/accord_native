import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { CustomerSummary } from '../shared/dispatchRuntimeStores';
import { dispatchRecordFromJson, type DispatchRecord } from '../shared/notificationApi';
import { customerDeliveryResponseBody, trimCustomerInput, type CustomerDeliveryResponse } from './customerLogic';
import type { CustomerStatusKind } from './customerStore';

type ObjectValue = Record<string, unknown>;
export type CustomerDeliveryDetail = {
  record: DispatchRecord;
  canApprove: boolean;
  canReject: boolean;
  canPartiallyAccept: boolean;
  canReportClaim: boolean;
};

function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid customer object');
  return value as ObjectValue;
}
function bool(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== 'boolean') throw new TypeError('Invalid customer boolean');
  return value;
}
function customerRecordFromJson(value: unknown): DispatchRecord {
  const source = object(value);
  // The shared parser is reused unchanged. Dart's native trim additionally
  // removes U+0085 around a status before parseDispatchStatus compares it.
  return dispatchRecordFromJson(typeof source.status === 'string'
    ? { ...source, status: trimCustomerInput(source.status) } : source);
}
function customerFailure(message: string): Error {
  const error = new Error(message);
  error.name = 'Exception';
  return error;
}

// JSON.parse loses whether 1 was written as 1.0 or 1e0. V2 casts summary
// counters to Dart int, so retain each top-level value's original JSON token.
// JSON.parse has already validated the entire input before this scanner runs.
function topLevelValueSources(source: string): Map<string, string> {
  const values = new Map<string, string>();
  let index = 0;
  const whitespace = () => { while (index < source.length && /[ \t\n\r]/.test(source[index])) index++; };
  const stringEnd = () => {
    index++;
    while (index < source.length) {
      if (source[index] === '\\') { index += 2; continue; }
      if (source[index++] === '"') return;
    }
  };
  const valueEnd = () => {
    const first = source[index];
    if (first === '"') { stringEnd(); return; }
    if (first === '{' || first === '[') {
      const stack = [first === '{' ? '}' : ']']; index++;
      while (stack.length) {
        const char = source[index];
        if (char === '"') { stringEnd(); continue; }
        if (char === '{' || char === '[') stack.push(char === '{' ? '}' : ']');
        else if (char === stack[stack.length - 1]) stack.pop();
        index++;
      }
      return;
    }
    while (index < source.length && !/[ \t\n\r,}\]]/.test(source[index])) index++;
  };
  whitespace(); index++; whitespace();
  while (source[index] !== '}') {
    const keyStart = index; stringEnd();
    const key = JSON.parse(source.slice(keyStart, index)) as string;
    whitespace(); index++; whitespace();
    const start = index; valueEnd(); values.set(key, source.slice(start, index));
    whitespace();
    if (source[index] === ',') { index++; whitespace(); } else break;
  }
  return values;
}

/** @v2 CustomerHomeSummary.fromJson */
export function customerSummaryFromJsonText(source: string): CustomerSummary {
  const data = object(JSON.parse(source));
  const tokens = topLevelValueSources(source);
  const count = (key: string): number => {
    const value = Object.hasOwn(data, key) ? data[key] : null;
    if (value == null) return 0;
    const token = tokens.get(key) ?? '';
    if (typeof value !== 'number' || !/^-?(?:0|[1-9]\d*)$/.test(token) || !Number.isSafeInteger(value)) {
      throw new TypeError('Invalid customer count');
    }
    return value === 0 ? 0 : value;
  };
  return { pendingCount: count('pending_count'), confirmedCount: count('confirmed_count'), rejectedCount: count('rejected_count') };
}

/** @v2 CustomerDeliveryDetail.fromJson */
export function customerDeliveryDetailFromJson(value: unknown): CustomerDeliveryDetail {
  const data = object(value);
  return {
    record: customerRecordFromJson(data.record ?? {}),
    canApprove: bool(data.can_approve),
    canReject: bool(data.can_reject),
    canPartiallyAccept: bool(data.can_partially_accept),
    canReportClaim: bool(data.can_report_claim),
  };
}

/** @v2 customerSummary */
export async function customerSummary(session: Session): Promise<CustomerSummary> {
  const response = await authorizedFetch(session, '/v1/mobile/customer/summary');
  if (response.status !== 200) throw customerFailure('Customer summary failed');
  return customerSummaryFromJsonText(await response.text());
}

/** @v2 customerStatusDetails */
export async function customerStatusDetails(session: Session, kind: CustomerStatusKind): Promise<DispatchRecord[]> {
  const query = new URLSearchParams({ kind });
  const response = await authorizedFetch(session, `/v1/mobile/customer/status-details?${query}`);
  if (response.status !== 200) throw customerFailure('Customer status details failed');
  const result: unknown = await response.json();
  if (!Array.isArray(result)) throw new TypeError('Invalid customer status list');
  return result.map(customerRecordFromJson);
}

/** @v2 customerDeliveryDetail */
export async function customerDeliveryDetail(session: Session, deliveryNoteID: string): Promise<CustomerDeliveryDetail> {
  const query = new URLSearchParams({ delivery_note_id: deliveryNoteID });
  const response = await authorizedFetch(session, `/v1/mobile/customer/detail?${query}`);
  if (response.status !== 200) throw customerFailure('Customer detail failed');
  return customerDeliveryDetailFromJson(await response.json());
}

/** @v2 customerRespondDelivery */
export async function customerRespondDelivery(session: Session, reply: CustomerDeliveryResponse): Promise<CustomerDeliveryDetail> {
  const body = JSON.stringify(customerDeliveryResponseBody(reply));
  const response = await authorizedFetch(session, '/v1/mobile/customer/respond', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  if (response.status !== 200) throw customerFailure('Customer respond failed');
  return customerDeliveryDetailFromJson(await response.json());
}
