import type { QolipHomeGridProps } from './qolipHomeGridProps';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipLocationEntry } from './qolipLocationsApi';

/** No callbacks or boundary default to a fake implementation; the real owner remains an integration requirement. */
export type QolipHomeBlockBodyProps = Pick<QolipHomeGridProps, 'searchCounts' | 'refresh' | 'openCell' | 'printCell'> & {
  blockKey: string;
  future: Promise<readonly QolipLocationEntry[]>;
  initialLocations: readonly QolipLocationEntry[] | null;
  boundary: QolipHomeReadBoundary;
};
