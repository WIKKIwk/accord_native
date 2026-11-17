import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { QolipHomePickerProps } from './qolipHomePickerTypes';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { searchRelevanceScore } from './qolipSearchRelevance';

/** V2 M3AsyncPickerSheet paging and selection, used by Home issue and worker pickers. */
export function useQolipHomePicker<T>(props: QolipHomePickerProps<T>) {
  const boundary = useQolipPassiveBoundary(props.boundary), generation = useRef(0), loading = useRef(false);
  const [query, setQuery] = useState(''), [items, setItems] = useState<readonly T[]>([]);
  const [busy, setBusy] = useState(true), [error, setError] = useState(false), [more, setMore] = useState(true);
  const [selected, setSelected] = useState<ReadonlyMap<string, T>>(new Map());
  const callbacks = useRef(props);
  const state = useRef({ items, query });
  useLayoutEffect(() => { callbacks.current = props; state.current = { items, query }; }, [props, items, query]);
  const load = async (reset: boolean) => {
    if (!boundary.isCurrent() || (!reset && loading.current)) return;
    const id = ++generation.current, offset = reset ? 0 : state.current.items.length;
    loading.current = true; setBusy(true); setError(false);
    if (reset) setItems([]);
    try {
      const rows = await callbacks.current.loadPage(state.current.query.trim(), offset, 80);
      if (generation.current !== id || !boundary.isCurrent()) return;
      setItems(previous => reset ? rows : [...previous, ...rows]); setMore(rows.length >= 80);
    } catch { if (generation.current === id && boundary.isCurrent()) setError(true); }
    finally { if (generation.current === id && boundary.isCurrent()) { loading.current = false; setBusy(false); } }
  };
  useEffect(() => {
    const counter = generation, inFlight = loading;
    const timer = setTimeout(() => { void load(true); }, query ? 220 : 0);
    return () => { clearTimeout(timer); counter.current++; inFlight.current = false; };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (item: T) => {
    if (!boundary.isCurrent() || !props.multiple) return;
    setSelected(previous => { const next = new Map(previous), key = props.itemKey(item); if (next.has(key)) next.delete(key); else next.set(key, item); return next; });
  };
  const tap = (item: T) => {
    if (!boundary.isCurrent()) return;
    if (selected.size) toggle(item); else props.select([item], false);
  };
  const visible = !query.trim() || items.length < 2 ? items : items.map((item, index) => ({ item, index,
    score: searchRelevanceScore(query.trim(), props.itemTitle(item), [props.itemSubtitle(item)]) }))
    .sort((left, right) => right.score - left.score || left.index - right.index).map(row => row.item);
  return { ...boundary, items: visible, query, setQuery, busy, error, more, selected, toggle, tap,
    confirm: () => { if (boundary.isCurrent() && selected.size) props.select([...selected.values()], true); },
    retry: () => { void load(true); }, loadMore: () => { if (more && !busy && !error) void load(false); } };
}
