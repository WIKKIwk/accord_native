import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { getWorkerTabs, type WorkerTabsProps } from './workerTabModel';

export function WorkerTabs(props: WorkerTabsProps) {
  return <OrdersWorkspace {...props} tabs={getWorkerTabs(props.machines, props.completedLabel)} />;
}
