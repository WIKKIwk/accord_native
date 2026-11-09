import type { QolipCellPlacementState } from './qolipCellPlacementState';
import type { QolipPlacementProduct } from './qolipCellPlacement';

export type QolipCellPickerProps = {
  placement: QolipCellPlacementState;
  close: () => void;
  single: (product: QolipPlacementProduct) => void;
  multiple: (products: QolipPlacementProduct[]) => void;
};
