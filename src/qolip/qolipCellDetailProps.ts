import type { QolipCellDetailChoice, QolipCellDetailOptions } from './qolipCellDetailState';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

/** The caller receives a source choice only; it must not dispatch a held action. */
export type QolipCellDetailProps = QolipCellDetailOptions & {
  boundary: QolipHomeReadBoundary;
  choose: (choice: QolipCellDetailChoice) => void;
};
