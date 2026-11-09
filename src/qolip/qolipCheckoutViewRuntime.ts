import type { Session } from '../auth';
import { qolipCheckouts } from './qolipCheckoutApi';
import { qolipCheckoutBoundary } from './qolipCheckoutReadRuntime';
import { QolipCheckoutReadState } from './qolipCheckoutReadState';
import { QolipCheckoutSelectionState, type QolipCheckoutLocks } from './qolipCheckoutSelectionState';
import { QolipCheckoutViewState } from './qolipCheckoutViewState';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

/** The caller owns the original witness and real action locks. This factory captures neither. */
export function createQolipCheckoutView(session: Session, boundary: QolipHomeReadBoundary, locks: QolipCheckoutLocks) {
  const roleBoundary = qolipCheckoutBoundary(session, boundary);
  const selection = new QolipCheckoutSelectionState([], [], locks, roleBoundary);
  const read = new QolipCheckoutReadState(roleBoundary, guard => qolipCheckouts(session, { status: 'open', limit: 200 }, guard),
    entries => selection.recordLoaded(entries));
  return new QolipCheckoutViewState(read, selection, locks);
}
