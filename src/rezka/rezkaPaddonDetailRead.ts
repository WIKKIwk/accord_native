import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import { adminPaddonDetail } from '../paddonManagementApi';
import type { paddonSnapshotFromJson } from '../paddonModels';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { rezkaPaddonDetailOwnerInput, subscribeRezkaPaddonDetailOwner, type RezkaPaddonDetailOwner } from './rezkaPaddonDetailLifetime';
import { assignedPaddonApparatus } from './rezkaPaddonScope';
import { guardedRezkaRequest, isRezkaSessionCurrent, RezkaScopeChanged, type RezkaSessionSnapshot } from './rezkaSessionGuard';

export { createRezkaPaddonDetailOwner } from './rezkaPaddonDetailLifetime';

type Detail = ReturnType<typeof paddonSnapshotFromJson>;
export type RezkaPaddonDetailBinding = Readonly<{ owner: RezkaSessionSnapshot; data: Detail; catalog: readonly AdminApparatus[] }>;
/** Optional per-attempt gate for a future owner that supports suspend and refresh generations. */
export type RezkaPaddonDetailReadControl = Readonly<{ isCurrent(): boolean; canSend(): boolean; waitForSend(): Promise<void> }>;
const issued = new WeakMap<object, RezkaPaddonDetailOwner>();

/** Internal rejection; a future host must map this to V2's ordinary load-failure state. */
export class RezkaPaddonDetailUnavailable extends Error {}

/** Only data returned by this adapter can be used by the prepared passive fragments. */
export function isRezkaPaddonDetailBinding(value: unknown, owner: RezkaSessionSnapshot): value is RezkaPaddonDetailBinding {
  if (!value || typeof value !== 'object') return false;
  const view = issued.get(value), input = view && rezkaPaddonDetailOwnerInput(view);
  return !!input && input.snapshot === owner && (value as RezkaPaddonDetailBinding).owner === owner &&
    isRezkaSessionCurrent(owner, 'master') && canOpenRoute(owner.session, appRoutes.apparatusPaddonDetail);
}

/** Retire already-mounted fragments when their original view closes. */
export function subscribeRezkaPaddonDetailBinding(value: unknown, listener: () => void): () => void {
  const view = value && typeof value === 'object' ? issued.get(value) : undefined;
  return view ? subscribeRezkaPaddonDetailOwner(view, listener) : () => {};
}

// Fresh JSON-decoded API results are private to this read. Freeze their full
// object graph so a later caller cannot swap an assigned pallet or its contents.
function freezeGraph<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const seen = new WeakSet<object>(), pending: object[] = [value];
  while (pending.length) {
    const item = pending.pop()!;
    if (seen.has(item)) continue;
    seen.add(item);
    for (const child of Object.values(item)) if (child && typeof child === 'object') pending.push(child);
    Object.freeze(item);
  }
  return value;
}

// A role-local gate must return true synchronously. A rejected async callback
// cannot authorize a send or leave an unhandled rejection.
function syncTrue(check: () => boolean): boolean {
  try {
    const result: unknown = check();
    if (result === true) return true;
    if (result && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
  } catch { /* Fail closed. */ }
  return false;
}

/** Unconnected read-only adapter. It never opens a route or invokes a Paddon mutation. */
export async function readRezkaPaddonDetail(view: RezkaPaddonDetailOwner, control?: RezkaPaddonDetailReadControl): Promise<RezkaPaddonDetailBinding> {
  const input = rezkaPaddonDetailOwnerInput(view);
  if (!input) throw new RezkaScopeChanged(false);
  const { snapshot, apparatusId: apparatus, code: normalizedCode } = input;
  const ownerCurrent = () => rezkaPaddonDetailOwnerInput(view) === input && isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddonDetail) && !!apparatus &&
    snapshot.session.assigned_apparatus.some(id => id.trim() === apparatus);
  const current = () => ownerCurrent() && (!control || syncTrue(() => control.isCurrent())) && ownerCurrent();
  const canSend = () => current() && (!control || syncTrue(() => control.canSend())) && current();
  if (!apparatus || !normalizedCode) throw new RezkaPaddonDetailUnavailable();
  if (!current()) throw new RezkaScopeChanged(false);
  const read = async <T>(send: (beforeSend: () => void) => Promise<T>): Promise<T> => {
    try {
      const value = await guardedRezkaRequest(snapshot.session, 'master', snapshot, false, beforeSend => send(() => {
        if (!canSend()) throw new RezkaScopeChanged(false);
        beforeSend();
      }));
      if (!current()) throw new RezkaScopeChanged(false);
      return value;
    } catch (error) {
      if (!current()) throw new RezkaScopeChanged(false);
      throw error;
    }
  };
  const catalog = await read(beforeSend => adminApparatus(snapshot.session, { limit: 10000, beforeSend }));
  if (control) {
    try { await control.waitForSend(); }
    catch (error) { if (!current()) throw new RezkaScopeChanged(false); throw error; }
  }
  if (!current()) throw new RezkaScopeChanged(false);
  if (!assignedPaddonApparatus(catalog, snapshot.session.assigned_apparatus).some(row => row.id === apparatus))
    throw new RezkaPaddonDetailUnavailable();
  const data = await read(beforeSend => adminPaddonDetail(snapshot.session, normalizedCode, { beforeSend }));
  if (data.paddon.code.trim() !== normalizedCode || data.paddon.apparatus_id.trim() !== apparatus)
    throw new RezkaPaddonDetailUnavailable();
  freezeGraph(data); freezeGraph(catalog);
  if (!current()) throw new RezkaScopeChanged(false);
  const binding = Object.freeze({ owner: snapshot, data, catalog }); issued.set(binding, view); return binding;
}
