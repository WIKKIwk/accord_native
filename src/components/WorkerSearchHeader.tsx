import { useSyncExternalStore } from 'react';
import { OrdersHeader, type OrdersHeaderProps } from '../shared/orders/OrdersHeader';
import type { WorkerSearchInput } from '../workerSearchInput';

type WithoutSearch<T> = T extends unknown ? Omit<T, 'search' | 'onSearchChange'> : never;
type Props = WithoutSearch<OrdersHeaderProps> & { input: WorkerSearchInput };

export function WorkerSearchHeader({ input, ...props }: Props) {
  const search = useSyncExternalStore(input.subscribeText, input.getText, input.getText);
  return <OrdersHeader {...props} search={search} onSearchChange={input.change} />;
}
