import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { WorkerControlException } from '../workerControlsApi';
import { jsonObject } from './preparationModel';
import { sessionReadScope } from '../sessionReadScope';
import { preparationLibraryCache } from './preparationLibraryCache';

export function preparationStorageKey(session: Session): string {
  if (session.profile?.role !== 'tayyorlov_masteri' || !session.profile.ref || !session.capabilities?.includes('preparation.access')) {
    throw new WorkerControlException('forbidden', 'Tayyorlov masteri huquqi kerak');
  }
  return `preparation.pending.v1:${session.baseUrl}:${session.profile.ref}`;
}
export function preparationGuard(session: Session, accountError = false): () => void {
  const key = preparationStorageKey(session);
  return () => {
    if (preparationStorageKey(session) !== key) {
      if (accountError) throw new WorkerControlException('account_changed', 'Akkaunt o‘zgargan. Sahifani qayta oching');
      throw new Error('Akkaunt o‘zgargan');
    }
  };
}
export async function preparationResponse(response: Response): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> | null = null;
  try { data = jsonObject(await response.json()); } catch { /* A corrupt success is not confirmation. */ }
  if (response.status !== 200 || !data) {
    throw new WorkerControlException('preparation_request_failed',
      typeof data?.error === 'string' ? data.error : 'Tayyorlov ma’lumotlari olinmadi. Qayta urinib ko‘ring', response.status);
  }
  return data;
}
export async function preparationRequest(session: Session, path: string, init: RequestInit = {}, accountError = false) {
  const guard = preparationGuard(session, accountError);
  const response = await authorizedFetch(session, path, init, guard);
  guard();
  const data = await preparationResponse(response);
  guard();
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()) &&
      /^\/v1\/mobile\/preparation\/(?:formulas|formula-sets|formula-variants)(?:\/|\?|$)/.test(path)) {
    preparationLibraryCache.invalidate(sessionReadScope(session));
  }
  return data;
}
export function withQuery(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString().replace(/=(?=&|$)/g, '');
  return `${path}?${query}`;
}
export function invalidResponse(message: string): never {
  throw new WorkerControlException('preparation_invalid_response', message);
}
