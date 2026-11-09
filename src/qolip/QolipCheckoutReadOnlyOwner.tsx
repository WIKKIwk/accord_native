import type { Session } from '../auth';
import { QolipCheckoutReadContent } from './QolipCheckoutReadContent';
import type { QolipCheckoutLocks } from './qolipCheckoutSelectionState';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { useQolipCheckoutView } from './useQolipCheckoutView';

type Props = { session: Session; boundary: QolipHomeReadBoundary; locks: QolipCheckoutLocks };

// Unrouted, partial read-only composition. No return, bulk-return, retry or refresh callback exists here.
export function QolipCheckoutReadOnlyOwner({ session, boundary, locks }: Props) {
  const snapshot = useQolipCheckoutView(session, boundary, locks);
  return <QolipCheckoutReadContent snapshot={snapshot} />;
}
