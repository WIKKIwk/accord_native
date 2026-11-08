import type { AdminWorkMapMoveSelection } from './adminWorkMapMoveModel';
export type AdminWorkMapMovePane = { id: 'top' | 'bottom'; name: string; rows: readonly { id: string; position: string; headline: string; supporting: string }[];
  loading: boolean; loaded: boolean; error: string | null; empty: string; moreLabel: string; retryLabel: string; hasMore: boolean;
  onRefresh: () => Promise<void>; onMore: () => Promise<void>; onPick: () => void };
export type AdminWorkMapMoveProps = { loading: boolean; error: string | null; empty: string; retryLabel: string;
  panes: readonly AdminWorkMapMovePane[]; onRetry: () => Promise<void> };

export type AdminWorkMapMovePickerProps = { title: string; rows: readonly { selection: AdminWorkMapMoveSelection; key: string; name: string; selected: boolean }[];
  onChoose: (selection: AdminWorkMapMoveSelection) => void };
