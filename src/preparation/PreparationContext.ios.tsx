import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '../auth';
import { usePreparationHome } from './usePreparationHome';

type Home = ReturnType<typeof usePreparationHome>;
type Context = { session: Session; home: Home; onLogout: () => void };
const PreparationContext = createContext<Context | null>(null);

export function PreparationProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const home = usePreparationHome(session);
  return <PreparationContext.Provider value={{ session, home, onLogout }}>{children}</PreparationContext.Provider>;
}
export function usePreparationContext() {
  const value = useContext(PreparationContext);
  if (!value) throw new Error('Tayyorlov sessiyasi mavjud emas');
  return value;
}
