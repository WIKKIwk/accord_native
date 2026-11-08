import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Session } from '../auth';
type Value = { session: Session; onLogout: () => void; chatClosing: boolean; setChatClosing: (closing: boolean) => void };
const Context = createContext<Value | null>(null);
export function BoyoqchiProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const [chatClosing, setChatClosing] = useState(false);
  return <Context.Provider value={{ session, onLogout, chatClosing, setChatClosing }}>{children}</Context.Provider>;
}
export function useBoyoqchiContext() {
  const value = useContext(Context);
  if (!value) throw new Error('Boyoqchi session unavailable');
  return value;
}
