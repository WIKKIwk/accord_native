import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipRoleReadBoundary } from './qolipRoleReadBoundary';
import { qolipManagedSets } from './qolipSetsApi';
import { QolipSetsReadState } from './qolipSetsReadState';

/** The caller supplies its original witness and the actual source mutation lock; neither is invented here. */
export function createQolipSetsRead(session: Session, boundary: QolipHomeReadBoundary, saving: boolean) {
  return new QolipSetsReadState(qolipRoleReadBoundary(session, boundary), guard => qolipManagedSets(session, guard), saving);
}
