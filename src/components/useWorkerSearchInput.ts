import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { WorkerSearchInput } from '../workerSearchInput';

/** Only a committed query rerenders the queue; raw edits belong to its search field. */
export function useWorkerSearchInput(scope: string) {
  const { input } = useMemo(() => ({ scope, input: new WorkerSearchInput() }), [scope]);
  const query = useSyncExternalStore(input.subscribeQuery, input.getQuery, input.getQuery);
  useEffect(() => () => input.cancelPending(), [input]);
  return { input, query };
}
