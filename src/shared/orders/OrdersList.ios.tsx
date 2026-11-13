import { List } from '@expo/ui/swift-ui';
import { listStyle, refreshable, scrollContentBackground, scrollEdgeEffectStyle } from '@expo/ui/swift-ui/modifiers';
import { useCallback } from 'react';
import type { OrdersListProps } from './OrdersList.types';

const indexKey = (_row: unknown, index: number) => String(index);

export function OrdersList<T = never>({ children, footer, rows, renderRow, rowKey, onRefresh }: OrdersListProps<T>) {
  const renderNativeRow = useCallback(({ item, index }: { item: T; index: number }) => <>{renderRow?.(item, index)}</>, [renderRow]);
  return <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), scrollEdgeEffectStyle('soft', 'top'), refreshable(onRefresh)]}>
    {children}
    {rows && renderRow ? <List.ForEach data={rows} keyExtractor={rowKey ?? indexKey}>{renderNativeRow}</List.ForEach> : null}
    {footer}
  </List>;
}
