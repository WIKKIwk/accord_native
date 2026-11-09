import type { Session } from '../auth';
import { authorizedFetch, authorizedImageFetch } from '../authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from '../workerControlsApi';
import { ensureBoyoqchiRealSession } from './returnedPaintDemoGuard';
import { returnedPaintCompleteToJson, returnedPaintRequestFromJson, returnedPaintRequestPageFromJson,
  returnedPaintImageFromJson, type ReturnedPaintCompleteSubmission, type ReturnedPaintImage,
  type ReturnedPaintRequest, type ReturnedPaintRequestPage } from './returnedPaintModel';

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Json : null;

async function returnedPaintException(response: Response, code: string, fallback: string): Promise<WorkerControlException> {
  let message = '';
  try {
    const payload = object(await response.json());
    if (typeof payload?.error === 'string') message = payload.error.trim();
  } catch { /* V2 uses its feature-specific fallback for non-JSON responses. */ }
  return new WorkerControlException(code, message || fallback, response.status);
}
async function mapBody(response: Response): Promise<Json> {
  const parsed = object(await response.json());
  if (!parsed) throw new TypeError('Expected returned paint object');
  return parsed;
}

/** @v2 boyoqchiReturnedPaintRequests */
export async function boyoqchiReturnedPaintRequests(session: Session, limit = 20, offset = 0,
  options?: { beforeSend?: () => void; signal?: AbortSignal }): Promise<ReturnedPaintRequestPage> {
  ensureBoyoqchiRealSession(session);
  const query = new URLSearchParams({ limit: String(limit) });
  if (offset > 0) query.set('offset', String(offset));
  const response = await authorizedFetch(session, `/v1/mobile/returned-paint/requests?${query}`, options?.signal ? { signal: options.signal } : undefined,
    () => { ensureBoyoqchiRealSession(session); options?.beforeSend?.(); });
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_load_failed', 'Qaytarilgan bo‘yoq ma’lumotlari yuklanmadi');
  }
  return returnedPaintRequestPageFromJson(await mapBody(response));
}

/** @v2 completeReturnedPaint */
export async function completeReturnedPaint(session: Session, input: ReturnedPaintCompleteSubmission, options?: {
  beforeSend?: () => void; verifyResponse?: (body: Record<string, unknown>) => void;
}): Promise<ReturnedPaintRequest> {
  ensureBoyoqchiRealSession(session);
  const response = await authorizedFetch(session, '/v1/mobile/returned-paint/requests/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(returnedPaintCompleteToJson(input)),
  }, () => { ensureBoyoqchiRealSession(session); options?.beforeSend?.(); });
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_complete_failed', 'Qaytarilgan bo‘yoq hisoboti saqlanmadi');
  }
  const body = await mapBody(response);
  options?.verifyResponse?.(body);
  return returnedPaintRequestFromJson(body);
}

/** @v2 returnedPaintImageUrl */
export function returnedPaintImageUrl(baseUrl: string, imageUrl: string): string {
  const value = imageUrl.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value.startsWith('/') ? `${baseUrl}${value}` : value;
}

async function trainingError(response: Response, fallback: string): Promise<WorkerControlException> {
  let data: unknown = null;
  try { data = await response.json(); } catch { /* V2's shared error parser falls back when JSON is invalid. */ }
  return productionMapResponseError(response.status, data, fallback);
}

// Training error mappings depend on the shared production-map parser, which remains an open item.
export async function uploadTrainingReturnedPaintImage(session: Session, bytes: Uint8Array, filename: string,
  mime: string): Promise<ReturnedPaintImage> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/training/images', {
    method: 'POST', headers: { 'Content-Type': mime, 'x-file-name': filename }, body: new Uint8Array(bytes),
  });
  // V2 decodes the body as a map before testing the status, including on failures.
  const body = await mapBody(response);
  if (response.status !== 200) throw productionMapResponseError(response.status, body, 'training_returned_paint_image_save');
  return returnedPaintImageFromJson(object(body.image) ?? {});
}

export async function deleteTrainingReturnedPaintImage(session: Session, imageId: string): Promise<void> {
  const id = imageId.trim();
  if (!id) return;
  const query = new URLSearchParams({ id });
  const response = await authorizedFetch(session, `/v1/mobile/admin/training/images?${query}`, { method: 'DELETE' });
  if (response.status !== 200) throw await trainingError(response, 'training_returned_paint_image_delete');
}

export async function uploadReturnedPaintImage(session: Session, input: { orderId: string; apparatus: string;
  bytes: Uint8Array; filename: string; mime: string }): Promise<ReturnedPaintImage> {
  const apparatus = input.apparatus.trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  if (input.orderId.trim().startsWith('training-')) {
    return uploadTrainingReturnedPaintImage(session, input.bytes, input.filename, input.mime);
  }
  const query = new URLSearchParams({ order_id: input.orderId.trim(), apparatus });
  const name = input.filename.trim().replace(/[^A-Za-z0-9._ -]/g, '') || 'qaytarilgan-boyoq.jpg';
  const response = await authorizedFetch(session, `/v1/mobile/returned-paint/images?${query}`, {
    method: 'POST', headers: { 'Content-Type': input.mime, 'x-file-name': name }, body: new Uint8Array(input.bytes),
  });
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_image_upload_failed', 'Qaytarilgan bo‘yoq rasmi yuklanmadi');
  }
  const body = await mapBody(response);
  return returnedPaintImageFromJson(object(body.image) ?? {});
}

export async function deleteReturnedPaintImage(session: Session, imageId: string, orderId = ''): Promise<void> {
  if (orderId.trim().startsWith('training-')) return deleteTrainingReturnedPaintImage(session, imageId);
  const query = new URLSearchParams({ id: imageId.trim() });
  const response = await authorizedFetch(session, `/v1/mobile/returned-paint/images?${query}`, { method: 'DELETE' });
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_image_delete_failed', 'Qaytarilgan bo‘yoq rasmi olib tashlanmadi');
  }
}

// The existing transport refuses to send a bearer token to a foreign origin; see the status file.
export async function downloadReturnedPaintImage(session: Session, image: ReturnedPaintImage): Promise<Uint8Array> {
  const url = returnedPaintImageUrl(session.baseUrl, image.image_url);
  if (!url) throw new WorkerControlException('returned_paint_image_url_missing', 'Rasm manzili topilmadi');
  const response = await authorizedImageFetch(session, url);
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_image_download_failed', 'Rasm yuklab olinmadi');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new WorkerControlException('returned_paint_image_download_failed', 'Rasm yuklab olinmadi', response.status);
  return bytes;
}
