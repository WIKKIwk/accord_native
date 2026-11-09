import type { Session } from '../auth';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipPlacementProduct } from './qolipCellPlacement';
import type { QolipCellPlacementResult } from './qolipCellPlacementState';

export type QolipCellAttachSheetProps = {
  session: Session;
  blocks: readonly QolipBlock[];
  initialBlock?: QolipBlock | null;
  rowLetter?: string | null;
  columnNumber?: number | null;
  initialProduct?: QolipPlacementProduct | null;
  // The caller closes the sheet, refreshes this block and shows the success notice.
  saved: (result: Extract<NonNullable<QolipCellPlacementResult>, { kind: 'saved' }>) => void;
};
