import type { Session } from '../auth';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipBlockCreateOptions } from './qolipBlockCreateState';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

/** Unmounted sheet content. The caller must supply the original role boundary and actual sheet-result callback. */
export type QolipBlockCreateSheetProps = QolipBlockCreateOptions & {
  session: Session;
  boundary: QolipHomeReadBoundary;
  saved: (block: QolipBlock) => void;
};
