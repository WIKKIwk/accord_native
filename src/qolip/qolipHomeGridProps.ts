import type { QolipLocationEntry } from './qolipLocationsApi';

export type QolipHomeGridProps = {
  locations: readonly QolipLocationEntry[] | null;
  loading: boolean;
  error: boolean;
  searchCounts: Readonly<Record<string, number>>;
  refresh: () => Promise<void>;
  openCell: (letter: string, row: number, items: readonly QolipLocationEntry[]) => void;
  printCell: (letter: string, row: number) => void;
};
