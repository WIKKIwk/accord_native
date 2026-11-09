import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipBlocksData } from './qolipReadOnlyBlocksApi';
import { qolipRoleReadBoundary } from './qolipRoleReadBoundary';
import { qolipArchive, qolipPaddons } from './qolipStorageApi';
import { QolipStorageReadState } from './qolipStorageReadState';

/** Actual GETs bound to the shell's original role witness; no shared cache or write is introduced. */
export function createQolipStorageRead(session: Session, boundary: QolipHomeReadBoundary, archive: boolean,
  scheduleFrame: (callback: () => void) => void) {
  return new QolipStorageReadState(archive, qolipRoleReadBoundary(session, boundary), {
    archive: (input, guard) => qolipArchive(session, input, guard),
    paddons: (input, guard) => qolipPaddons(session, input, guard),
    warehouses: async guard => (await qolipBlocksData(session, guard)).warehouses,
    scheduleFrame,
  });
}
