import type { Session } from '../auth';
import type { SupplyTasksController } from '../shared/supplyTasks/SupplyTasksController';
import type { MaterialTaskHandlers } from './useMaterialTasksView';

export type MaterialTasksProps = { controller: SupplyTasksController; session: Session; locale: string;
  onMenu: () => void; onProfile: () => void; handlers?: MaterialTaskHandlers };
