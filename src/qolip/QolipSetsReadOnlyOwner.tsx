import type { Session } from '../auth';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipSetsReadContent } from './QolipSetsReadContent';
import { useQolipSetsRead } from './useQolipSetsRead';

type Props = { session: Session; boundary: QolipHomeReadBoundary; saving: boolean };

// Unrouted partial composition. The caller owns the original witness and real saving lock.
export function QolipSetsReadOnlyOwner({ session, boundary, saving }: Props) {
  const snapshot = useQolipSetsRead(session, boundary, saving);
  return <QolipSetsReadContent snapshot={snapshot} />;
}
