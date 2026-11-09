import type { Session } from '../auth';
import { qolipCheckouts } from './qolipCheckoutApi';
import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import { QolipCheckoutReadState } from './qolipCheckoutReadState';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipRoleReadBoundary } from './qolipRoleReadBoundary';

// Preserve the existing checkout entry point while sharing the same role-local read gate.
export { qolipRoleReadBoundary as qolipCheckoutBoundary } from './qolipRoleReadBoundary';

export function createQolipCheckoutRead(session: Session, boundary: QolipHomeReadBoundary,
  onLoaded?: (entries: readonly QolipCheckoutEntry[]) => boolean) {
  return new QolipCheckoutReadState(qolipRoleReadBoundary(session, boundary),
    guard => qolipCheckouts(session, { status: 'open', limit: 200 }, guard), onLoaded);
}
