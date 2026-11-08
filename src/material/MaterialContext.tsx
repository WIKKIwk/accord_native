import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '../auth';

type MaterialContextValue = { session: Session; onLogout(): void };
const MaterialContext = createContext<MaterialContextValue | null>(null);
export function MaterialProvider({ session, onLogout, children }: MaterialContextValue & { children: ReactNode }) {
  return <MaterialContext.Provider value={{ session, onLogout }}>{children}</MaterialContext.Provider>;
}
export function useMaterialContext() {
  const value = useContext(MaterialContext);
  if (!value) throw new Error('Material session unavailable');
  return value;
}
