import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { batchPrintBody, batchResponseFromJson, batchSessionFromJson, batchStartBody, batchStopBody, batchUpdateBody,
  materialReceiptPrintResponseFromJson, type GScaleBatchPrint, type GScaleBatchStart, type GScaleBatchUpdate } from './gscaleBatchModel';

type Obj = Record<string, unknown>;
const text = (value: unknown, fallback = '') => value == null || !String(value).trim() ? fallback : String(value).trim();
function decodeObject(body: string): Obj {
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
  } catch { return {}; }
}

async function request(session: Session, path: string, fallbackCode: string, fallbackMessage: string, body?: object,
  beforeSend?: () => void): Promise<Obj> {
  const response = await authorizedFetch(session, path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, beforeSend);
  const payload = decodeObject(await response.text());
  if (response.status !== 200) throw new MobileApiException({ code: text(payload.error, fallbackCode),
    message: text(payload.detail, text(payload.message, fallbackMessage)), statusCode: response.status });
  return payload;
}

/** @v2 gscaleMaterialTasks */
export async function gscaleMaterialTasks(session: Session, orderIds: string[]): Promise<Record<string, { material: string; micron: number; assigned: boolean }[]>> {
  if (!orderIds.length) return {};
  const response = await authorizedFetch(session, '/v1/mobile/gscale/material-tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_ids: orderIds }),
  });
  if (response.status !== 200) throw new MobileApiException({ code: 'material_tasks_failed', message: 'Material vazifalari yuklanmadi', statusCode: response.status });
  const payload = decodeObject(await response.text());
  if (payload.orders != null && !Array.isArray(payload.orders)) throw new TypeError('Invalid GScale orders');
  const result: Record<string, { material: string; micron: number; assigned: boolean }[]> = {};
  for (const value of (payload.orders ?? []) as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const order = value as Obj;
    if (order.materials != null && !Array.isArray(order.materials)) throw new TypeError('Invalid GScale materials');
    result[String(order.order_id ?? null)] = ((order.materials ?? []) as unknown[]).filter(v => v && typeof v === 'object' && !Array.isArray(v)).map(value => {
      const material = value as Obj;
      if (typeof material.micron !== 'number') throw new TypeError('Invalid material micron');
      return { material: material.material == null ? '' : String(material.material), micron: material.micron, assigned: material.assigned === true };
    });
  }
  return result;
}

/** @v2 gscaleRpsBatchStart */
export async function gscaleRpsBatchStart(session: Session, data: GScaleBatchStart, beforeSend?: () => void) {
  return batchResponseFromJson(await request(session, '/v1/mobile/rps/batch/start', 'rps_batch_start_failed', 'RPS batch start failed', batchStartBody(data), beforeSend));
}
/** @v2 gscaleRpsBatchUpdate */
export async function gscaleRpsBatchUpdate(session: Session, data: GScaleBatchUpdate, beforeSend?: () => void) {
  return batchResponseFromJson(await request(session, '/v1/mobile/rps/batch/update', 'rps_batch_update_failed', 'RPS batch update failed', batchUpdateBody(data), beforeSend));
}
/** @v2 gscaleRpsBatchState */
export async function gscaleRpsBatchState(session: Session) {
  return batchResponseFromJson(await request(session, '/v1/mobile/rps/batch/state', 'rps_batch_state_failed', 'RPS batch state failed'));
}
/** @v2 gscaleRpsBatchHistory */
export async function gscaleRpsBatchHistory(session: Session, limit = 50) {
  const payload = await request(session, `/v1/mobile/rps/batch/history?limit=${Math.min(100, Math.max(1, limit))}`,
    'rps_batch_history_failed', 'RPS batch history failed');
  if (payload.batches == null) return [];
  if (!Array.isArray(payload.batches)) throw new TypeError('Invalid GScale batch history');
  return payload.batches.filter(v => v && typeof v === 'object' && !Array.isArray(v)).map(batchSessionFromJson);
}
/** @v2 gscaleRpsBatchStop */
export async function gscaleRpsBatchStop(session: Session, batchId: string, revision: number, beforeSend?: () => void) {
  return batchResponseFromJson(await request(session, '/v1/mobile/rps/batch/stop', 'rps_batch_stop_failed', 'RPS batch stop failed', batchStopBody(batchId, revision), beforeSend));
}
/** @v2 gscaleRpsBatchPrint */
export async function gscaleRpsBatchPrint(session: Session, data: GScaleBatchPrint, beforeSend?: () => void) {
  return materialReceiptPrintResponseFromJson(await request(session, '/v1/mobile/rps/batch/print', 'rps_batch_print_failed', 'RPS batch print failed', batchPrintBody(data), beforeSend));
}
/** @v2 gscaleRpsBatchClientPrintPrepare */
export async function gscaleRpsBatchClientPrintPrepare(session: Session, data: GScaleBatchPrint, beforeSend?: () => void) {
  const code = 'rps_batch_client_print_prepare_failed';
  return materialReceiptPrintResponseFromJson(await request(session, '/v1/mobile/rps/batch/client-print/prepare', code, code, batchPrintBody(data), beforeSend));
}
/** @v2 gscaleRpsBatchClientPrintConfirm */
export async function gscaleRpsBatchClientPrintConfirm(session: Session, data: GScaleBatchPrint, epc: string, beforeSend?: () => void) {
  const code = 'rps_batch_client_print_confirm_failed';
  return materialReceiptPrintResponseFromJson(await request(session, '/v1/mobile/rps/batch/client-print/confirm', code, code, { ...batchPrintBody(data), epc: epc.trim() }, beforeSend));
}
