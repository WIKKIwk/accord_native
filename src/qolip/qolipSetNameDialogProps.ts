import type { Session } from '../auth';
import type { QolipManagedSet } from './qolipSetsApi';
export type QolipSetNameDialogProps = { session: Session; entry: QolipManagedSet;
  close: () => void; saved: (entry: QolipManagedSet) => void };
