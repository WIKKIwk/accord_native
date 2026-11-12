import { isValidElement, type ReactNode } from 'react';
import { OrdersList } from '../shared/orders/OrdersList';
import { WorkerQueueConnectionProgress } from './WorkerQueueConnectionProgress';
import { WorkerQueueFilter } from './WorkerQueueFilter';

type Props = React.ComponentProps<typeof OrdersList>;
export function WorkerQueueList(props: Props) {
  return <OrdersList {...props} passthrough={(item: ReactNode) => isValidElement(item) &&
    (item.type === WorkerQueueFilter || item.type === WorkerQueueConnectionProgress)} />;
}
