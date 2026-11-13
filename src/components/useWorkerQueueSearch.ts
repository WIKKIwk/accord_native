import { useEffect, useState } from 'react';
import { workerQueueSearch } from '../workerQueueWindow';

/** @v2 _onOrdersSearchChanged keeps the live queue window until typing settles. */
export function useWorkerQueueSearch(value: string): string {
  const [query, setQuery] = useState(() => workerQueueSearch(value));
  useEffect(() => {
    const timer = setTimeout(() => setQuery(workerQueueSearch(value)), 350);
    return () => clearTimeout(timer);
  }, [value]);
  return query;
}
