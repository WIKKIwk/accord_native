import { useCallback, useEffect, useRef, useState } from 'react';
import { preparationFormulaErrorMessage } from './usePreparationFormula';
import type { PreparationVariantsState } from './usePreparationVariants';

type Entry = Awaited<ReturnType<PreparationVariantsState['loadReusePage']>>[number];
const pageSize = 80;

export function usePreparationReusePicker(controller: PreparationVariantsState) {
  const [query, setQueryState] = useState(''), [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Entry[]>([]), [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false), [error, setError] = useState<string | null>(null);
  const generation = useRef(0), loadingRef = useRef(false), queryRef = useRef('');
  const setQuery = useCallback((value: string) => {
    if (value === queryRef.current) return;
    queryRef.current = value;
    generation.current++; loadingRef.current = false; setQueryState(value);
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    loadingRef.current = true; setLoading(true); setItems([]); setHasMore(false); setError(null);
    void controller.loadReusePage(query, 0, pageSize).then(page => {
      if (generation.current !== current) return;
      setItems(page); setHasMore(page.length === pageSize);
    }).catch(reason => { if (generation.current === current) setError(preparationFormulaErrorMessage(reason)); })
      .finally(() => { if (generation.current === current) { loadingRef.current = false; setLoading(false); } });
    return () => { generation.current++; };
  }, [controller, query, revision]);
  const loadMore = () => {
    if (loadingRef.current || !hasMore || error) return;
    const current = generation.current;
    loadingRef.current = true; setLoading(true);
    void controller.loadReusePage(query, items.length, pageSize).then(page => {
      if (generation.current !== current) return;
      setItems(previous => [...previous, ...page]); setHasMore(page.length === pageSize);
    }).catch(reason => { if (generation.current === current) setError(preparationFormulaErrorMessage(reason)); })
      .finally(() => { if (generation.current === current) { loadingRef.current = false; setLoading(false); } });
  };
  return { items, loading, hasMore, error, setQuery, loadMore, retry: () => setRevision(value => value + 1) };
}
