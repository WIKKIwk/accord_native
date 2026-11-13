import { List } from '@expo/ui';
import { Fragment } from 'react';
import type { OrdersListProps } from './OrdersList.types';

export function OrdersList<T = never>({ children, footer, rows, renderRow, rowKey, onRefresh }: OrdersListProps<T>) {
  return <List onRefresh={onRefresh}>{children}{rows && renderRow ? rows.map((row, index) => <Fragment key={rowKey?.(row, index) ?? index}>{renderRow(row, index)}</Fragment>) : null}{footer}</List>;
}
