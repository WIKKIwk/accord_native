import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { MobileApiException } from './shared/mobileApiException';
import { productionMapResponseError } from './workerControlsApi';

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const text = (value: unknown) => value == null ? '' : String(value);
const number = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid numeric value');
  return value;
};
const integer = (value: unknown) => {
  const parsed = number(value);
  if (!Number.isFinite(parsed)) throw new TypeError('Invalid integer value');
  return Math.trunc(parsed);
};
const list = (value: unknown): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid list value');
  return value;
};
const rows = (value: unknown) => list(value).filter(item => item && typeof item === 'object' && !Array.isArray(item));
const model = (value: unknown): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid response');
  return value as Json;
};

/** @v2 WorkerMaterialCandidate */
export type WorkerMaterialCandidate = { barcode: string; itemName: string; placementVersion: number };
/** @v2 WorkerMaterialCandidates */
export type WorkerMaterialCandidates = { enabled: boolean; candidates: WorkerMaterialCandidate[] };
export function workerMaterialCandidatesFromJson(raw: unknown): WorkerMaterialCandidates {
  const data = model(raw);
  return { enabled: data.enabled === true, candidates: rows(data.candidates).map(value => {
    const row = object(value);
    return { barcode: text(row.barcode).trim(), itemName: text(row.item_name), placementVersion: integer(row.placement_version) };
  }).filter(row => row.barcode.length > 0 && row.placementVersion > 0) };
}
/** @v2 MaterialLinkRoll */
export type MaterialLinkRoll = { barcode: string; itemName: string; qty: number; uom: string; locationName: string };
/** @v2 MaterialLinkRequest */
export type MaterialLinkRequest = { id: string; status: string; revision: number; orderId: string; orderNumber: string;
  apparatusId: string; apparatusName: string; requesterRef: string; requesterName: string; moverRef: string; moverName: string;
  decidedBy: string; decidedAt: number; reason: string; expiresAt: number; rolls: MaterialLinkRoll[]; selectedBarcodes: string[] };
/** @v2 MaterialLinkOverview */
export type MaterialLinkOverview = { availableCount: number; candidates: MaterialLinkRoll[]; requests: MaterialLinkRequest[] };
function rollFromJson(raw: unknown): MaterialLinkRoll {
  const data = model(raw);
  return { barcode: text(data.barcode), itemName: text(data.item_name), qty: number(data.qty),
    uom: text(data.uom), locationName: text(data.location_name) };
}
export function materialLinkRequestFromJson(raw: unknown): MaterialLinkRequest {
  const data = model(raw);
  return { id: text(data.request_id), status: text(data.status), revision: integer(data.event_sequence), orderId: text(data.order_id),
    orderNumber: text(data.order_number), apparatusId: text(data.apparatus_id), apparatusName: text(data.apparatus_name),
    requesterRef: text(data.requester_ref), requesterName: text(data.requester_display_name), moverRef: text(data.mover_ref), moverName: text(data.mover_display_name),
    decidedBy: text(data.decided_by_name), decidedAt: integer(data.decided_at_unix), reason: text(data.reason), expiresAt: integer(data.expires_at_unix),
    rolls: rows(data.candidates).map(rollFromJson), selectedBarcodes: list(data.selected_barcodes).map(String) };
}
export function materialLinkOverviewFromJson(raw: unknown): MaterialLinkOverview {
  const data = model(raw);
  return { availableCount: integer(data.available_count), candidates: rows(data.candidates).map(rollFromJson), requests: rows(data.requests).map(materialLinkRequestFromJson) };
}
export function materialLinkStatusLabel(status: string): string {
  return ({ pending: 'Tasdiq kutilmoqda', approved: 'Tasdiqlangan', cancelled: 'Bekor qilingan',
    stale: 'Holati o‘zgargan — so‘rov yopilgan', expired: 'So‘rov muddati tugagan' } as Record<string, string>)[status] ?? 'Holatni yangilang';
}

const linkMessages: Record<string, string> = {
  material_link_no_candidates: 'Bu apparat state’ida orderga ulash mumkin bo‘lgan rulon qolmagan',
  material_link_selection_required: 'Ulash uchun rulonlarni tanlang',
  material_link_candidates_changed: 'Tanlangan rulonning joyi yoki holati o‘zgargan. Rulonlarni qayta tanlang',
  material_link_not_found: 'So‘rov topilmadi', raw_material_order_not_active: 'Order faol emas',
};
async function request(session: Session, path: string, fallback: string, body?: Json, signal?: AbortSignal): Promise<Json> {
  const controller = new AbortController(), abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 10_000);
  try {
    const response = await authorizedFetch(session, path, { signal: controller.signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    let raw: unknown;
    try { raw = await response.json(); } catch { raw = null; }
    if (response.status !== 200) {
      if (fallback.startsWith('material_link')) {
        const code = text(object(raw).error);
        throw new MobileApiException({ code, message: linkMessages[code] ?? (response.status === 403
          ? 'Bu so‘rov bo‘yicha amal qilishga ruxsat yo‘q' : 'So‘rov holatini yangilab bo‘lmadi. Qayta urinib ko‘ring'), statusCode: response.status });
      }
      throw productionMapResponseError(response.status, raw, fallback, response.headers);
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid response');
    return raw as Json;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
/** @v2 workerMaterialCandidates */
export async function workerMaterialCandidates(session: Session, orderId: string, apparatus: string, signal?: AbortSignal) {
  return workerMaterialCandidatesFromJson(await request(session, `/v1/mobile/worker-material-use?${new URLSearchParams({ order_id: orderId, apparatus })}`, 'worker_material_candidates', undefined, signal));
}
/** @v2 useWorkerMaterial */
export async function useWorkerMaterial(session: Session, orderId: string, apparatus: string, material: WorkerMaterialCandidate) {
  const result = await request(session, '/v1/mobile/worker-material-use', 'worker_material_use', {
    order_id: orderId, apparatus, barcode: material.barcode, placement_version: material.placementVersion });
  if (result.ok !== true || text(result.barcode).toUpperCase() !== material.barcode.toUpperCase()) {
    throw new MobileApiException({ code: 'worker_material_use_unconfirmed', message: 'Xomashyo ulanishi tasdiqlanmadi' });
  }
}
/** @v2 materialLinkRequests */
export async function materialLinkRequests(session: Session, orderId: string, apparatus: string, signal?: AbortSignal) {
  return materialLinkOverviewFromJson(await request(session, `/v1/mobile/material-link-requests?${new URLSearchParams({ order_id: orderId, apparatus })}`, 'material_link_requests', undefined, signal));
}
/** @v2 createMaterialLinkRequests */
export async function createMaterialLinkRequests(session: Session, orderId: string, apparatus: string, barcodes: string[]) {
  if (!barcodes.length) throw new MobileApiException({ code: 'material_link_selection_required', message: 'So‘rov yuborish uchun rulonlarni tanlang' });
  await request(session, '/v1/mobile/material-link-requests', 'material_link_requests', { action: 'create', order_id: orderId, apparatus, barcodes });
}
/** @v2 decideMaterialLinkRequest */
export async function decideMaterialLinkRequest(session: Session, requestId: string, action: string, barcodes: string[] = []) {
  if (action === 'approve' && !barcodes.length) throw new MobileApiException({ code: 'material_link_selection_required', message: 'Ulash uchun rulon tanlang' });
  const data = await request(session, '/v1/mobile/material-link-requests', 'material_link_requests', { request_id: requestId, action, barcodes });
  return materialLinkRequestFromJson(data.request);
}
