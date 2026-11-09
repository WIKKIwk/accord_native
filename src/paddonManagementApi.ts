import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { paddonFromJson, paddonSnapshotFromJson } from './paddonModels';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminPaddonCreate */
export async function adminPaddonCreate(session: Session, input: { location?: string; note?: string; apparatus?: string } = {}) {
  const body: Obj = { location: input.location?.trim() ?? '', note: input.note?.trim() ?? '' };
  if (input.apparatus?.trim()) body.apparatus = input.apparatus.trim();
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_create');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid paddon create response');
  if (!object(payload.paddon)) throw new WorkerControlException('paddon_create', 'Paddon yaratilmadi');
  return paddonFromJson(payload.paddon);
}

/** @v2 adminPaddonDelete */
export async function adminPaddonDelete(session: Session, code: string): Promise<void> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_delete');
  }
}

function checkedPaddonReadGuard(beforeSend: () => void): () => void {
  return () => {
    const result: unknown = beforeSend();
    if (result === undefined) return;
    // An accidentally async guard cannot authorize a send or leak a rejection.
    if (result !== null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
    throw new TypeError('Paddon read guard must be synchronous');
  };
}

/** @v2 adminPaddonDetail */
export async function adminPaddonDetail(session: Session, code: string, options: { beforeSend?: () => void } | undefined = undefined) {
  const normalized = code.trim();
  if (!normalized) throw new WorkerControlException('paddon_not_found', 'Paddon topilmadi');
  const query = new URLSearchParams({ code: normalized });
  const path = `/v1/mobile/admin/production-maps/paddons/detail?${query}`;
  const beforeSend = options?.beforeSend;
  const response = beforeSend ? await authorizedFetch(session, path, {}, checkedPaddonReadGuard(beforeSend))
    : await authorizedFetch(session, path);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_not_found');
  }
  return paddonSnapshotFromJson(await response.json());
}

/** @v2 adminPaddonQrReport */
export async function adminPaddonQrReport(session: Session, code: string) {
  const normalized = code.trim();
  if (!normalized) throw new WorkerControlException('paddon_not_found', 'Paddon topilmadi');
  const query = new URLSearchParams({ code: normalized });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/paddons/qr/report?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_not_found');
  }
  return paddonSnapshotFromJson(await response.json());
}

/** @v2 adminPaddons */
export async function adminPaddons(session: Session, input: { limit?: number; selectable_only?: boolean; apparatus?: string;
  beforeSend?: () => void } = {}) {
  const limit = Math.min(200, Math.max(1, Math.trunc(input.limit ?? 100)));
  const query = new URLSearchParams({ limit: String(limit) });
  if (input.apparatus?.trim()) query.set('apparatus', input.apparatus.trim());
  if (input.selectable_only) query.set('selectable_only', 'true');
  const path = `/v1/mobile/admin/production-maps/paddons?${query}`;
  // Preserve the legacy call shape while allowing scoped callers to check the
  // original witness immediately before the first send and any 401 retry.
  const beforeSend = input.beforeSend;
  const checkedGuard = beforeSend ? checkedPaddonReadGuard(beforeSend) : undefined;
  const response = checkedGuard ? await authorizedFetch(session, path, {}, checkedGuard) : await authorizedFetch(session, path);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddons_list');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid paddon list response');
  return Array.isArray(payload.paddons) ? payload.paddons.filter(item => object(item)).map(paddonFromJson) : [];
}
