import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

export type QolipHomePickerProps<T> = {
  title: string; hint: string; boundary: QolipHomeReadBoundary;
  loadPage(query: string, offset: number, limit: number): Promise<readonly T[]>;
  itemKey(item: T): string; itemTitle(item: T): string; itemSubtitle(item: T): string;
  multiple?: boolean;
  close(): void; select(items: T[], multiple: boolean): void;
};
