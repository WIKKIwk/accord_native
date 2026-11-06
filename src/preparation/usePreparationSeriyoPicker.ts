import { useEffect, useMemo, useState } from 'react';
import type { PreparationMaterial } from './preparationLogic';
import { preparationSeriyoSearch } from './preparationSeriyoSearch';

export function usePreparationSeriyoPicker(materials: readonly PreparationMaterial[]) {
  const [input, setInput] = useState(''), [query, setQuery] = useState(''), [limit, setLimit] = useState(50);
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(input); setLimit(50); }, 220);
    return () => clearTimeout(timer);
  }, [input]);
  const result = useMemo(() => preparationSeriyoSearch(materials, query, limit), [materials, query, limit]);
  return { ...result, setQuery: setInput, loadMore: () => { if (result.hasMore) setLimit(current => current + 50); } };
}
