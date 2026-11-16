import type { Session, SessionWitness } from '../auth';
import type { AdminWarehouseSummary } from './warehouseApi';

/** Real parent Warehouse state is required; this tab exposes no route or synthetic main screen. */
export type AdminWarehouseSettingsProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  summaries: readonly AdminWarehouseSummary[]; warehouse: string | null; bottomPadding: number; filterExpanded: boolean;
  onFilterToggle: () => void; onWarehouseChanged: (warehouse: string) => void;
  onChanged: () => Promise<void>; onDeleted: () => Promise<void>;
};
