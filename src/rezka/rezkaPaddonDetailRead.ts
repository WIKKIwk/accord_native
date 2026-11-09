import { adminApparatus, type AdminApparatus } from '../apparatusApi';
import { adminPaddonDetail } from '../paddonManagementApi';
import type { paddonSnapshotFromJson } from '../paddonModels';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { assignedPaddonApparatus } from './rezkaPaddonScope';
import { guardedRezkaRequest, isRezkaSessionCurrent, RezkaScopeChanged, type RezkaSessionSnapshot } from './rezkaSessionGuard';

type Detail = ReturnType<typeof paddonSnapshotFromJson>;
export type RezkaPaddonDetailBinding = Readonly<{ owner: RezkaSessionSnapshot; data: Detail; catalog: readonly AdminApparatus[] }>;
const issued = new WeakSet<object>();

/** Internal rejection; a future host must map this to V2's ordinary load-failure state. */
export class RezkaPaddonDetailUnavailable extends Error {}

/** Only data returned by this adapter can be used by the prepared passive fragments. */
export function isRezkaPaddonDetailBinding(value: unknown, owner: RezkaSessionSnapshot): value is RezkaPaddonDetailBinding {
  return !!value && typeof value === 'object' && issued.has(value) && (value as RezkaPaddonDetailBinding).owner === owner &&
    isRezkaSessionCurrent(owner, 'master') && canOpenRoute(owner.session, appRoutes.apparatusPaddonDetail);
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

/** Unconnected read-only adapter. It never opens a route or invokes a Paddon mutation. */
export async function readRezkaPaddonDetail(snapshot: RezkaSessionSnapshot, apparatusId: string, code: string): Promise<RezkaPaddonDetailBinding> {
  const apparatus = apparatusId.trim(), normalizedCode = code.trim();
  const current = () => isRezkaSessionCurrent(snapshot, 'master') &&
    canOpenRoute(snapshot.session, appRoutes.apparatusPaddonDetail) && !!apparatus &&
    snapshot.session.assigned_apparatus.some(id => id.trim() === apparatus);
  if (!apparatus || !normalizedCode) throw new RezkaPaddonDetailUnavailable();
  if (!current()) throw new RezkaScopeChanged(false);
  const read = async <T>(send: (beforeSend: () => void) => Promise<T>): Promise<T> => {
    try {
      const value = await guardedRezkaRequest(snapshot.session, 'master', snapshot, false, beforeSend => send(() => {
        if (!current()) throw new RezkaScopeChanged(false);
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
  if (!assignedPaddonApparatus(catalog, snapshot.session.assigned_apparatus).some(row => row.id === apparatus))
    throw new RezkaPaddonDetailUnavailable();
  const data = await read(beforeSend => adminPaddonDetail(snapshot.session, normalizedCode, { beforeSend }));
  if (data.paddon.code.trim() !== normalizedCode || data.paddon.apparatus_id.trim() !== apparatus)
    throw new RezkaPaddonDetailUnavailable();
  freezeGraph(data); freezeGraph(catalog);
  if (!current()) throw new RezkaScopeChanged(false);
  const binding = Object.freeze({ owner: snapshot, data, catalog }); issued.add(binding); return binding;
}
