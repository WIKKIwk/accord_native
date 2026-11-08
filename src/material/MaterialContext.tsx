import { createContext, useContext, type ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

type MaterialContextValue = { session: Session; witness: SessionWitness; onLogout(): void };
const MaterialContext = createContext<MaterialContextValue | null>(null);
export function MaterialProvider({ session, witness, onLogout, children }: MaterialContextValue & { children: ReactNode }) {
  return <MaterialContext.Provider value={{ session, witness, onLogout }}>{children}</MaterialContext.Provider>;
}
export function useMaterialContext() {
  const value = useContext(MaterialContext);
  if (!value) throw new Error('Material session unavailable');
  return value;
}
