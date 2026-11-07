import { useEffect, useMemo, useState } from 'react';
import { preparationOrderPickerResults, type PreparationOrderCandidate } from './preparationOrderCandidateSearch';

export function usePreparationInventoryOrderPicker(candidates: readonly PreparationOrderCandidate[]) {
  const [input, setInput] = useState(''), [query, setQuery] = useState(''), [limit, setLimit] = useState(50);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(input); setLimit(50); }, 220);
    return () => clearTimeout(timer);
  }, [input]);
  const result = useMemo(() => preparationOrderPickerResults(candidates, query, limit), [candidates, query, limit]);
  return { ...result, setInput, loadMore: () => { if (result.hasMore) setLimit(current => current + 50); } };
}
