import type { ReactNode } from 'react';
import type { QolipTransferProduct } from './qolipProductTransferState';
export type QolipTransferRowProps = { item: QolipTransferProduct; index: number; first: boolean; last: boolean; selected: boolean; disabled: boolean;
  subtitle: string; onToggle(): void; trailing: ReactNode };
export type QolipTransferControlsProps = { hint: string; scanLabel: string; refreshLabel: string; disabled: boolean; scan(): void; refresh(): void };
