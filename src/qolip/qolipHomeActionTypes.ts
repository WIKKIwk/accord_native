import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import type { QolipBlock } from './qolipBlocksApi';
export type QolipHomeMenuProps = { title?: string; subtitle?: string; info?: string; note?: string; actions: readonly { id: string; label: string; icon?: AndroidSymbol; symbol?: SFSymbol; disabled?: boolean }[]; choose(id: string): void };
export type QolipHomeBlockChoiceProps = { title: string; blocks: readonly QolipBlock[]; choose(block: QolipBlock): void };
export type QolipHomeDialogModel = { title: string; message?: string; input?: string; helper?: string; error?: string; confirm: string; cancel: string; change(value: string): void; accept(): void; close(): void };
