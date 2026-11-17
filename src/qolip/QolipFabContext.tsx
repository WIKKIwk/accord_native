import { useFocusEffect, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { View } from 'react-native';
import { QolipFabOverlay } from './QolipFabOverlay';
export type QolipFabAction = { id: string; label: string; icon?: AndroidSymbol; symbol?: SFSymbol; disabled?: boolean };
type Entry = { owner: object; path: string; actions: readonly QolipFabAction[]; onSelect(id: string): void; enabled: boolean };
const Context = createContext<((entry: Entry) => () => void) | null>(null);
export function QolipFabProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Entry | null>(null), path = usePathname();
  const register = useCallback((next: Entry) => { setEntry(next); return () => setEntry(current => current?.owner === next.owner ? null : current); }, []);
  return <Context.Provider value={register}><View style={{ flex: 1 }}>{children}
    {entry && entry.path === path && entry.enabled && entry.actions.length > 0 && <QolipFabOverlay actions={entry.actions} onSelect={entry.onSelect} resetKey={path} />}
  </View></Context.Provider>;
}
export function useQolipFab(actions: readonly QolipFabAction[], select: (id: string) => void, enabled = true) {
  const register = useContext(Context), path = usePathname(), owner = useRef({}), callback = useRef(select);
  useLayoutEffect(() => { callback.current = select; }, [select]);
  const key = JSON.stringify(actions), stable = useMemo(() => JSON.parse(key) as QolipFabAction[], [key]);
  const onSelect = useCallback((id: string) => callback.current(id), []);
  useFocusEffect(useCallback(() => register?.({ owner: owner.current, path, actions: stable, onSelect, enabled }), [register, path, stable, onSelect, enabled]));
}
