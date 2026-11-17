import type { ReactNode } from 'react';
export type StorageRow = { id: string; title: string; subtitle?: string; imageOrderId?: string; section?: boolean; onPress?(): void; onLongPress?(): void;
  selected?: boolean | null; onSelect?(): void; disabled?: boolean; trailing?: { label: string; onPress(): void } };
export type StorageListProps = { rows: readonly StorageRow[]; header?: ReactNode; footer?: ReactNode; loading?: boolean; refresh?(): void;
  query?: string; searchHint?: string; onQuery?(value: string): void; onViewport?(after: number): void;
  title?: string; onBack?(): void; onMenu?(): void; onProfile?(): void; dock?: ReactNode; searchEnabled?: boolean };
export type StorageFilterProps = { label: string; selected: boolean; expanded: boolean; value: string;
  options: readonly { value: string; label: string }[]; toggle(): void; choose(value: string): void };
export type StorageConfirmation = { title: string; message: string; confirm: string; cancel: string; destructive: boolean; resolve(value: boolean): void };
export type StorageSelectionProps = { codes: readonly string[]; empty: string; disabled: boolean; remove(code: string): void };

export type StorageScannerManualProps = { value: string; busy: boolean; label: string; acceptLabel: string; change(value: string): void; submit(): void };
