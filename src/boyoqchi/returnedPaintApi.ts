import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { WorkerControlException } from '../workerControlsApi';
import { returnedPaintCompleteToJson, returnedPaintRequestFromJson, returnedPaintRequestPageFromJson,
  type ReturnedPaintCompleteSubmission, type ReturnedPaintRequest, type ReturnedPaintRequestPage } from './returnedPaintModel';

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
export async function boyoqchiReturnedPaintRequests(session: Session, limit = 20, offset = 0): Promise<ReturnedPaintRequestPage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (offset > 0) query.set('offset', String(offset));
  const response = await authorizedFetch(session, `/v1/mobile/returned-paint/requests?${query}`);
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_load_failed', 'Qaytarilgan bo‘yoq ma’lumotlari yuklanmadi');
  }
  return returnedPaintRequestPageFromJson(await mapBody(response));
}

/** @v2 completeReturnedPaint */
export async function completeReturnedPaint(session: Session, input: ReturnedPaintCompleteSubmission): Promise<ReturnedPaintRequest> {
  const response = await authorizedFetch(session, '/v1/mobile/returned-paint/requests/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(returnedPaintCompleteToJson(input)),
  });
  if (response.status !== 200) {
    throw await returnedPaintException(response, 'returned_paint_complete_failed', 'Qaytarilgan bo‘yoq hisoboti saqlanmadi');
  }
  return returnedPaintRequestFromJson(await mapBody(response));
}

/** @v2 returnedPaintImageUrl */
export function returnedPaintImageUrl(baseUrl: string, imageUrl: string): string {
  const value = imageUrl.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value.startsWith('/') ? `${baseUrl}${value}` : value;
}
