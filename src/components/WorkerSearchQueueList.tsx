import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { OrdersListProps } from '../shared/orders/OrdersList.types';
import type { WorkerSearchInput } from '../workerSearchInput';
import { filterWorkerSearchRows, indexWorkerSearchRows, mergeWorkerSearchRows } from '../workerSearchRows';
import { WorkerQueueList } from './WorkerQueueList';

export type WorkerSearchQueueListProps<T> = Omit<OrdersListProps<T>, 'rows' | 'renderRow' | 'rowKey'> & {
  input: WorkerSearchInput;
  rows: readonly T[];
  sourceQuery: string | null;
  serverQuery: string;
  serverReady: boolean;
  limit: number;
  searchText: (row: T) => string;
  rowKey: (row: T, index: number) => string;
  previewAllowed?: boolean;
  filterServerRows?: boolean;
  emptyState?: ReactNode;
  loading: boolean;
  renderRow: (row: T, index: number, visibleCount: number, preview: boolean) => ReactNode;
};

const noSubscribe = () => () => {};

/** Only the visible list follows keystrokes; the screen retains its committed server window. */
export function WorkerSearchQueueList<T>({ input, rows, sourceQuery, serverQuery, serverReady, limit, searchText, rowKey,
  previewAllowed = true, filterServerRows = false, emptyState, loading, renderRow, children, active, ...props }: WorkerSearchQueueListProps<T>) {
  const committedSnapshot = useCallback(() => serverQuery, [serverQuery]);
  const query = useSyncExternalStore(active ? input.subscribeText : noSubscribe,
    active ? input.getDraftQuery : committedSnapshot, committedSnapshot);
  const [baseline, setBaseline] = useState<readonly T[] | null>(() => previewAllowed && sourceQuery === '' ? rows : null);
  const nextBaseline = !previewAllowed ? null : sourceQuery === '' ? rows : baseline;
  if (nextBaseline !== baseline) setBaseline(nextBaseline);
  const candidates = useMemo(() => previewAllowed ? mergeWorkerSearchRows(nextBaseline, rows, rowKey) : rows,
    [nextBaseline, rows, rowKey, previewAllowed]);
  const index = useMemo(() => indexWorkerSearchRows(candidates, searchText), [candidates, searchText]);
  const currentIndex = useMemo(() => filterServerRows && candidates !== rows ? indexWorkerSearchRows(rows, searchText) : index,
    [filterServerRows, candidates, rows, searchText, index]);
  const visibleRows = useMemo(() => {
    if (query !== sourceQuery) return filterWorkerSearchRows(index, query, limit);
    if (filterServerRows) return filterWorkerSearchRows(currentIndex, query, limit);
    return limit > 0 && rows.length > limit ? rows.slice(0, limit) : rows;
  }, [query, sourceQuery, filterServerRows, currentIndex, limit, rows, index]);
  const preview = query !== serverQuery || !serverReady;
  const renderVisibleRow = useCallback((row: T, position: number) => renderRow(row, position, visibleRows.length, preview),
    [renderRow, visibleRows.length, preview]);

  return <WorkerQueueList {...props} active={active} rows={visibleRows} rowKey={rowKey} renderRow={renderVisibleRow}>
    {children}
    {!preview && !loading && !visibleRows.length ? emptyState : null}
  </WorkerQueueList>;
}
