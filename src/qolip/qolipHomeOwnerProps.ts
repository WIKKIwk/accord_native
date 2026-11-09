import type { Session } from '../auth';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipHomeGridProps } from './qolipHomeGridProps';

/** No route/shell/dock or unsafe action implementation is provided by this adapter. */
export type QolipHomeOwnerProps = {
  session: Session;
  boundary: QolipHomeReadBoundary;
  onMenu: () => void;
  onProfile: () => void;
  openCell: (block: QolipBlock, ...args: Parameters<QolipHomeGridProps['openCell']>) => void;
  printCell: (block: QolipBlock, ...args: Parameters<QolipHomeGridProps['printCell']>) => void;
};
