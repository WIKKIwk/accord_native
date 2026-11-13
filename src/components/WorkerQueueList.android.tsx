import { isValidElement, type ReactNode } from 'react';
import { OrdersList } from '../shared/orders/OrdersList';
import { WorkerQueueConnectionProgress } from './WorkerQueueConnectionProgress';
import { WorkerQueueFilter } from './WorkerQueueFilter';
import type { OrdersListProps } from '../shared/orders/OrdersList.types';

export function WorkerQueueList<T = never>(props: OrdersListProps<T>) {
  return <OrdersList {...props} passthrough={(item: ReactNode) => isValidElement(item) &&
    (item.type === WorkerQueueFilter || item.type === WorkerQueueConnectionProgress)} />;
}
