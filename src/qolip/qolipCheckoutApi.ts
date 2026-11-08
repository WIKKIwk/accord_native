import { activeSessionToken, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { qolipCatalogRuntimeFor } from '../shared/qolipCatalogRuntime';
import { dartQuery, jsonObject, optionalInteger, optionalText, qolipApiResponseError, trimDart } from './qolipApiCommon';

/** @v2 QolipWorkerOption */
export type QolipWorkerOption = { id: string; name: string; level: string };
/** @v2 QolipCheckoutEntry */
export type QolipCheckoutEntry = {
  id: string; location_id: string; block: string; warehouse: string; item_code: string; item_name: string;
  qolip_code: string; size: number; quantity: number; row_letter: string; column_number: number | null;
  location_label: string; issued_to_name: string; status: string; issued_at: string; is_open: boolean;
};

export function qolipWorkerFromJson(value: unknown): QolipWorkerOption {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip worker');
  return { id: optionalText(row.id), name: optionalText(row.name), level: optionalText(row.level) };
}

export function qolipCheckoutFromJson(value: unknown): QolipCheckoutEntry {
  const row = jsonObject(value);
  if (!row) throw new TypeError('Invalid Qolip checkout');
  const status = optionalText(row.status);
  return { id: optionalText(row.id), location_id: optionalText(row.location_id), block: optionalText(row.block),
    warehouse: optionalText(row.warehouse), item_code: optionalText(row.item_code), item_name: optionalText(row.item_name),
    qolip_code: optionalText(row.qolip_code), size: optionalInteger(row.size) ?? 0, quantity: optionalInteger(row.quantity) ?? 0,
    row_letter: optionalText(row.row_letter), column_number: optionalInteger(row.column_number),
    location_label: optionalText(row.location_label), issued_to_name: optionalText(row.issued_to_name), status,
    issued_at: optionalText(row.issued_at), is_open: trimDart(status).toLowerCase() === 'open' };
}

async function send(session: Session, path: string, body?: Record<string, unknown>): Promise<Response> {
  await Promise.resolve();
  if (activeSessionToken(session) === 'test-mode-token') throw new Error('Qolip test mode is not yet ported');
  return authorizedFetch(session, path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  const data = jsonObject(await response.json());
  if (!data) throw new TypeError('Expected JSON object');
  return data;
}

function invalidateCatalogIfCurrent(session: Session, scope: string): void {
  if (activeSessionToken(session) && scope === sessionReadScope(session)) {
    qolipCatalogRuntimeFor(session).invalidateDetails();
  }
}

/** @v2 qolipWorkers */
export async function qolipWorkers(session: Session, query = ''): Promise<QolipWorkerOption[]> {
  const params: Record<string, string> = {};
  if (trimDart(query)) params.q = trimDart(query);
  params.limit = '100';
  const response = await send(session, `/v1/mobile/qolip/workers?${dartQuery(params)}`);
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_workers_failed', 'Qolipchilar yuklanmadi.');
  const data = await responseData(response);
  if (data.workers == null) return [];
  if (!Array.isArray(data.workers)) throw new TypeError('Invalid Qolip workers');
  return data.workers.map(qolipWorkerFromJson);
}

/** @v2 qolipCheckouts */
export async function qolipCheckouts(session: Session, input: { block?: string; status?: string; limit?: number } = {}): Promise<QolipCheckoutEntry[]> {
  const block = trimDart(input.block ?? ''), status = trimDart(input.status ?? 'open');
  const params: Record<string, string> = {};
  if (block) params.block = block;
  if (status) params.status = status;
  params.limit = String(input.limit ?? 100);
  const response = await send(session, `/v1/mobile/qolip/checkouts?${dartQuery(params)}`);
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_checkouts_failed', 'Qarz daftari yuklanmadi.');
  const data = await responseData(response);
  if (data.checkouts == null) return [];
  if (!Array.isArray(data.checkouts)) throw new TypeError('Invalid Qolip checkouts');
  return data.checkouts.map(qolipCheckoutFromJson);
}

/** @v2 qolipIssueCheckout */
export async function qolipIssueCheckout(session: Session, input: {
  locationId: string; quantity: number; workerId: string;
}): Promise<QolipCheckoutEntry> {
  const scope = sessionReadScope(session);
  const response = await send(session, '/v1/mobile/qolip/checkouts', {
    location_id: trimDart(input.locationId), quantity: input.quantity, worker_id: trimDart(input.workerId),
  });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_checkout_failed', 'Qolip olish amalga oshmadi.');
  const data = await responseData(response);
  invalidateCatalogIfCurrent(session, scope);
  return qolipCheckoutFromJson(data.checkout);
}

/** @v2 qolipReturnCheckout */
export async function qolipReturnCheckout(session: Session, checkoutId: string,
  input: { rowLetter?: string; columnNumber?: number | null } = {}): Promise<QolipCheckoutEntry> {
  const scope = sessionReadScope(session), row = trimDart(input.rowLetter ?? '');
  const response = await send(session, '/v1/mobile/qolip/checkouts/return', {
    checkout_id: trimDart(checkoutId), ...(row ? { row_letter: row.toUpperCase() } : {}),
    ...(input.columnNumber != null ? { column_number: input.columnNumber } : {}),
  });
  if (response.status !== 200) throw await qolipApiResponseError(response, 'qolip_checkout_return_failed', 'Qolip qaytarilmadi.');
  const data = await responseData(response);
  invalidateCatalogIfCurrent(session, scope);
  return qolipCheckoutFromJson(data.checkout);
}
