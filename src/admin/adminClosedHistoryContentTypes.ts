import type { closedProductionOrderFromJson, productionOrderLogFromJson } from '../workerClosedOrders';
import type { AdminClosedHistoryState } from './adminClosedHistoryController';
import type { AdminWorkMapClosedRow } from './adminWorkMapClosedModel';

export type AdminClosedHistoryContentProps = { row: AdminWorkMapClosedRow; summary: ReturnType<typeof closedProductionOrderFromJson>;
  state: AdminClosedHistoryState; catalog: readonly { id: string; name: string }[]; onToggle: () => void; onRetry: () => void;
  onLog: (order: ReturnType<typeof closedProductionOrderFromJson>, log: ReturnType<typeof productionOrderLogFromJson>) => void };
