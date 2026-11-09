import type { ReactNode } from 'react';
import type { WerkaReceiveState } from './werkaReceiveLogic';

/** Shared role-specific footer; the parent must recheck the live session and state before confirmation/write. */
export type WerkaReceiveFooterProps = {
  state: WerkaReceiveState;
  confirming: boolean;
  error: string;
  locale: string;
  warehouses: readonly string[];
  warehouseLabel: (value: string) => string;
  receiptWarehouse: string;
  receiptAcceptedBy: string;
  canReceive: boolean;
  warning?: string;
  beforeReceipt?: ReactNode;
  onWarehouse: (warehouse: string) => void;
  onRequestReceive: () => void;
  onReload: () => void;
  onNextQr: () => void;
};
export function werkaReceiveFooterActions(props: WerkaReceiveFooterProps) {
  const { state } = props;
  return { canReceive: props.canReceive && !state.busy && !state.mustReload && state.receipt === null && state.warehouse !== null,
    canSelect: !state.busy, canReload: !state.busy, canNext: !state.busy };
}
