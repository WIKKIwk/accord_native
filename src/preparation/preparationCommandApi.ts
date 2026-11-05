import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { WorkerControlException } from '../workerControlsApi';
import { jsonObject, requiredString } from './preparationModel';
import { preparationResponse, preparationStorageKey } from './preparationRequest';

type PendingCommand = { kind: string; payload: Record<string, unknown>; request_id: string };
/** @v2 PreparationPendingCommand */
export function preparationPendingCommandFromJson(value: unknown): PendingCommand {
  const data = jsonObject(value);
  return { kind: requiredString(data.kind), payload: jsonObject(data.payload), request_id: requiredString(data.request_id) };
}
/** @v2 newPreparationRequestId */
export async function newPreparationRequestId(): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(16);
  return `prep-${Date.now() * 1000}-${Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
/** @v2 preparationPendingCommand */
export async function preparationPendingCommand(session: Session): Promise<PendingCommand | null> {
  const value = await Storage.getItem(preparationStorageKey(session));
  return value === null ? null : preparationPendingCommandFromJson(JSON.parse(value));
}
let sending = false;
const definitiveErrors = new Set(['preparation_invalid', 'preparation_conflict', 'preparation_scope', 'preparation_receipt_requires_qr',
  'preparation_warehouse_not_exclusive', 'preparation_insufficient_stock']);
async function submitCommand(session: Session, kind: string, path: string, payload: Record<string, unknown>) {
  if (sending) throw new Error('Saqlash davom etmoqda');
  if (Object.hasOwn(payload, 'request_id')) throw new Error('request_id is managed by the client');
  sending = true;
  try {
    const key = preparationStorageKey(session), raw = await Storage.getItem(key);
    const pending = raw === null ? { kind, payload, request_id: await newPreparationRequestId() }
      : preparationPendingCommandFromJson(JSON.parse(raw));
    if (pending.kind !== kind || JSON.stringify(pending.payload) !== JSON.stringify(payload)) {
      throw new WorkerControlException('pending_preparation', 'Avval oldingi operatsiya natijasini tekshiring');
    }
    await Storage.setItem(key, JSON.stringify(pending));
    const guard = () => { if (preparationStorageKey(session) !== key) throw new Error('Akkaunt o‘zgargan'); };
    const response = await authorizedFetch(session, `/v1/mobile/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending.payload, request_id: pending.request_id }),
    }, guard);
    let code: unknown;
    try { code = jsonObject(await response.clone().json()).code; } catch { /* The result is not a definitive rejection. */ }
    if (response.status >= 400 && response.status < 500 && typeof code === 'string' && definitiveErrors.has(code)) await Storage.removeItemAsync(key);
    const result = await preparationResponse(response);
    if (!(await Storage.removeItemAsync(key))) throw new Error('Operatsiya natijasini qayta tekshiring');
    guard();
    return result;
  } finally { sending = false; }
}
/** @v2 preparationSubmit */
export async function preparationSubmit(session: Session, kind: string, payload: Record<string, unknown>) {
  if (!['materials', 'receipts', 'consumptions'].includes(kind)) throw new Error(`Invalid preparation kind: ${kind}`);
  return submitCommand(session, kind, `preparation/${kind}`, payload);
}
/** @v2 preparationReverseReceipt */
export function preparationReverseReceipt(session: Session, receiptId: string, reason: string) {
  return submitCommand(session, 'receipt_reversals', 'preparation/receipt-reversals', { receipt_id: receiptId, reason });
}
/** @v2 gscaleSimpleMaterialReceipt */
export function gscaleSimpleMaterialReceipt(session: Session, payload: Record<string, unknown>) {
  return submitCommand(session, 'gscale_simple_receipt', 'gscale/material-receipt/simple', payload);
}
