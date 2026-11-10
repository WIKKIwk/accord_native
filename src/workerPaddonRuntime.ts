import { captureSessionWitness, isSessionWitnessCurrent, type Session } from './auth';
import { adminApparatus } from './apparatusApi';
import { sessionReadScope } from './sessionReadScope';
import { adminPaddonCreate, adminPaddonDelete, adminPaddonDetail, adminPaddonQrReport, adminPaddons } from './paddonManagementApi';
import { adminPaddonAddWips, adminPaddonRemoveWip, adminPaddonRemoveWips } from './paddonItemsApi';
import { adminProgressQrLookup } from './workerProgressApi';
import { unlockPaddon } from './paddonUnlockApi';
import { transferPaddonItems } from './paddonTransferApi';
import { WorkerPaddonRetired } from './workerPaddonModel';
import { WorkerPaddonList } from './workerPaddonList';
import { WorkerPaddonDetail } from './workerPaddonDetail';
import { WorkerPaddonTransfer } from './workerPaddonTransfer';
import { workerPaddonRevision } from './workerPaddonRevision';

/** One account/assignment witness for the lifetime of this route, including 401 retries. */
export function workerPaddonOwner(session: Session, apparatus: string, scope = sessionReadScope(session)) {
  const witness = captureSessionWitness(session);
  let mounted = false;
  const current = () => mounted && isSessionWitnessCurrent(witness) && scope === sessionReadScope(session) &&
    session.profile.role === 'aparatchi' && (!apparatus || session.assigned_apparatus.includes(apparatus));
  const guard = (valid: () => boolean) => () => { if (!current() || !valid()) throw new WorkerPaddonRetired(); };
  const catalog = (valid: () => boolean) => adminApparatus(session, { limit: 10000, beforeSend: guard(valid), readWitness: () => current() && valid() });
  const changed = () => { if (current()) workerPaddonRevision.notify(scope); };
  const list = new WorkerPaddonList({ session, apparatus, current, catalog,
    list: (id, valid) => adminPaddons(session, { apparatus: id, beforeSend: guard(valid) }),
    create: (id, valid) => adminPaddonCreate(session, { apparatus: id, beforeSend: guard(valid) }),
    remove: (code, valid) => adminPaddonDelete(session, code, guard(valid)) });
  return { current, guard, catalog, list, changed, mount(value: boolean) { mounted = value; },
    detail(code: string) { return new WorkerPaddonDetail({ code, current,
      read: valid => adminPaddonDetail(session, code, { beforeSend: guard(valid) }),
      add: (ids, valid) => adminPaddonAddWips(session, { paddon_code: code, progress_batch_ids: ids }, () => current() && valid()),
      remove: (ids, single, valid) => single ? adminPaddonRemoveWip(session, { paddon_code: code, progress_batch_id: ids[0] }, () => current() && valid())
        : adminPaddonRemoveWips(session, { paddon_code: code, progress_batch_ids: ids }, () => current() && valid()),
      lookup: (qr, valid) => adminProgressQrLookup(session, qr, { current: () => current() && valid() }),
      unlock: valid => unlockPaddon(session, code, () => current() && valid()), changed }); },
    transfer() { return new WorkerPaddonTransfer({ session, apparatus, current, catalog,
      list: (id, valid) => adminPaddons(session, { apparatus: id, limit: 200, selectable_only: true, beforeSend: guard(valid) }),
      read: (code, valid) => adminPaddonQrReport(session, code, { beforeSend: guard(valid) }),
      move: (from, to, ids, valid) => transferPaddonItems(session, from, to, ids, () => current() && valid()), changed }); },
  };
}
