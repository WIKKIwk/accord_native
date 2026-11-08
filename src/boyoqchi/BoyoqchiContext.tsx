import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '../auth';
const Context = createContext<{ session: Session; onLogout: () => void } | null>(null);
export function BoyoqchiProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  return <Context.Provider value={{ session, onLogout }}>{children}</Context.Provider>;
}
export function useBoyoqchiContext() {
  const value = useContext(Context);
  if (!value) throw new Error('Boyoqchi session unavailable');
  return value;
}
