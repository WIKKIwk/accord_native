import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
export type QolipHeaderAction = { id: string; label: string; icon: AndroidSymbol; symbol: SFSymbol; disabled?: boolean };
type Header = { actions: readonly QolipHeaderAction[]; hideProfile?: boolean; onSelect(id: string): void };
const Context = createContext<{ value: Header | null; register(value: Header, owner: object): () => void } | null>(null);
export function QolipPageHeaderProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<{ value: Header; owner: object } | null>(null);
  const register = useCallback((value: Header, owner: object) => { setEntry({ value, owner }); return () => setEntry(previous => previous?.owner === owner ? null : previous); }, []);
  return <Context.Provider value={{ value: entry?.value ?? null, register }}>{children}</Context.Provider>;
}
export const useQolipPageHeaderValue = () => useContext(Context)?.value;
export function useQolipPageHeader(actions: readonly QolipHeaderAction[], onSelect: (id: string) => void, hideProfile = false) {
  const context = useContext(Context), callback = useRef(onSelect), owner = useRef({}), key = JSON.stringify(actions);
  useLayoutEffect(() => { callback.current = onSelect; }, [onSelect]);
  const register = context?.register;
  useFocusEffect(useCallback(() => register?.({ actions: JSON.parse(key), onSelect: id => callback.current(id), hideProfile }, owner.current), [register, key, hideProfile]));
}
