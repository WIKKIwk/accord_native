import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipProductContainer } from './qolipProductContainer';

/** All flags and rows come from a real owner. This passive content cannot open or change anything. */
export type QolipProductPassiveContentProps = {
  boundary: QolipHomeReadBoundary;
  rows: readonly { container: QolipProductContainer; expanded: boolean; loading: boolean; errorMessage: string | null }[];
  reworkCodes: ReadonlySet<string>;
};
