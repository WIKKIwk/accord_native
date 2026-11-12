import { captureSessionWitness, isSessionWitnessCurrent, registerSessionResetHook, type Session } from './auth';
import { adminApparatus, type AdminApparatus } from './apparatusApi';
import { sessionReadScope } from './sessionReadScope';
import { adminPaddonCreate, adminPaddonDelete, adminPaddonDetail, adminPaddonQrReport, adminPaddons } from './paddonManagementApi';
import { adminPaddonAddWips, adminPaddonRemoveWip, adminPaddonRemoveWips } from './paddonItemsApi';
import { adminProgressQrLookup } from './workerProgressApi';
import { unlockPaddon } from './paddonUnlockApi';
import { transferPaddonItems } from './paddonTransferApi';
import { WorkerPaddonRetired, type WorkerPaddon, type WorkerPaddonSnapshot } from './workerPaddonModel';
import { WorkerPaddonList } from './workerPaddonList';
import { WorkerPaddonDetail } from './workerPaddonDetail';
import { WorkerPaddonTransfer } from './workerPaddonTransfer';
import { workerPaddonRevision } from './workerPaddonRevision';
import { WorkerPaddonReadCache } from './workerPaddonReadCache';

type Reads = { witness: ReturnType<typeof captureSessionWitness>; catalog: WorkerPaddonReadCache<AdminApparatus[]>;
  lists: Map<string, WorkerPaddonReadCache<WorkerPaddon[]>>; details: Map<string, WorkerPaddonReadCache<WorkerPaddonSnapshot>> };
const scopedReads = new Map<string, Reads>();
function invalidateReads(reads: Reads) {
  for (const entry of [...reads.lists.values(), ...reads.details.values()]) entry.invalidate();
}
function cachedRead<T>(entries: Map<string, WorkerPaddonReadCache<T>>, key: string) {
  let entry = entries.get(key);
  if (!entry) {
    entry = new WorkerPaddonReadCache<T>(); entries.set(key, entry);
    while (entries.size > 24) entries.delete(entries.keys().next().value!);
  }
  return entry;
}
function readsFor(session: Session, scope: string) {
  let reads = scopedReads.get(scope);
  if (!reads || !isSessionWitnessCurrent(reads.witness)) {
    if (reads) { reads.catalog.invalidate(); invalidateReads(reads); }
    reads = { witness: captureSessionWitness(session), catalog: new WorkerPaddonReadCache(), lists: new Map(), details: new Map() };
    scopedReads.set(scope, reads);
    while (scopedReads.size > 4) scopedReads.delete(scopedReads.keys().next().value!);
  }
  return reads;
}
registerSessionResetHook(async () => {
  for (const reads of scopedReads.values()) { reads.catalog.invalidate(); invalidateReads(reads); }
  scopedReads.clear();
});
workerPaddonRevision.subscribe(scope => { const reads = scopedReads.get(scope); if (reads) invalidateReads(reads); });

/** One account/assignment witness for the lifetime of this route, including 401 retries. */
export function workerPaddonOwner(session: Session, apparatus: string, scope = sessionReadScope(session)) {
  const witness = captureSessionWitness(session);
  const reads = readsFor(session, scope);
  let mounted = false;
  const scopeCurrent = () => isSessionWitnessCurrent(witness) && scope === sessionReadScope(session) &&
    session.profile.role === 'aparatchi' && (!apparatus || session.assigned_apparatus.includes(apparatus));
  const current = () => mounted && scopeCurrent();
  const guard = (valid: () => boolean) => () => { if (!current() || !valid()) throw new WorkerPaddonRetired(); };
  const catalog = (valid: () => boolean, force = true) => reads.catalog.read(
    () => adminApparatus(session, { limit: 10000, beforeSend: guard(valid), readWitness: () => current() && valid() }), () => current() && valid(), force);
  const mutate = <T,>(valid: () => boolean, run: () => Promise<T>) => { guard(valid)(); invalidateReads(reads); return run(); };
  const changed = () => { if (current()) workerPaddonRevision.notify(scope); };
  const list = new WorkerPaddonList({ session, apparatus, current, catalog,
    list: (id, valid, force = true) => cachedRead(reads.lists, id).read(
      () => adminPaddons(session, { apparatus: id, beforeSend: guard(valid) }), () => current() && valid(), force),
    create: (id, valid) => mutate(valid, () => adminPaddonCreate(session, { apparatus: id, beforeSend: guard(valid) })),
    remove: (code, valid) => mutate(valid, () => adminPaddonDelete(session, code, guard(valid))) });
  return { current, guard, catalog, cachedCatalog: () => scopeCurrent() ? reads.catalog.peek() : null,
    list, changed, mutate, mount(value: boolean) { mounted = value; },
    detail(code: string) { const entry = cachedRead(reads.details, code.trim()); return new WorkerPaddonDetail({ code, current,
      initial: scopeCurrent() ? entry.peek() : null,
      read: (valid, force = true) => entry.read(() => adminPaddonDetail(session, code, { beforeSend: guard(valid) }), () => current() && valid(), force),
      add: (ids, valid) => mutate(valid, () => adminPaddonAddWips(session, { paddon_code: code, progress_batch_ids: ids }, () => current() && valid())),
      remove: (ids, single, valid) => mutate(valid, () => single ? adminPaddonRemoveWip(session, { paddon_code: code, progress_batch_id: ids[0] }, () => current() && valid())
        : adminPaddonRemoveWips(session, { paddon_code: code, progress_batch_ids: ids }, () => current() && valid())),
      lookup: (qr, valid) => adminProgressQrLookup(session, qr, { current: () => current() && valid() }),
      unlock: valid => mutate(valid, () => unlockPaddon(session, code, () => current() && valid())), changed }); },
    transfer() { return new WorkerPaddonTransfer({ session, apparatus, current, catalog,
      list: (id, valid) => adminPaddons(session, { apparatus: id, limit: 200, selectable_only: true, beforeSend: guard(valid) }),
      read: (code, valid) => adminPaddonQrReport(session, code, { beforeSend: guard(valid) }),
      move: (from, to, ids, valid) => mutate(valid, () => transferPaddonItems(session, from, to, ids, () => current() && valid())), changed }); },
  };
}
