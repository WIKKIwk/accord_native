import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipLocationEntry } from './qolipLocationsApi';

/** Content only. The real caller supplies its localized title, original options, boundary and sheet-result callback. */
export type QolipLocationChoiceProps = {
  title: string;
  options: readonly QolipLocationEntry[];
  boundary: QolipHomeReadBoundary;
  choose: (item: QolipLocationEntry) => void;
};
