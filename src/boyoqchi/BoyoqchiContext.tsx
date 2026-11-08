import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { Session } from '../auth';
import type { BoyoqchiProfileNavigation } from './boyoqchiProfileNavigation';
type Value = { session: Session; onLogout: () => void; chatClosing: boolean; setChatClosing: (closing: boolean) => void;
  profileNavigation: { current: BoyoqchiProfileNavigation | null } };
const Context = createContext<Value | null>(null);
export function BoyoqchiProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const [chatClosing, setChatClosing] = useState(false), profileNavigation = useRef<BoyoqchiProfileNavigation | null>(null);
  return <Context.Provider value={{ session, onLogout, chatClosing, setChatClosing, profileNavigation }}>{children}</Context.Provider>;
}
export function useBoyoqchiContext() {
  const value = useContext(Context);
  if (!value) throw new Error('Boyoqchi session unavailable');
  return value;
}
