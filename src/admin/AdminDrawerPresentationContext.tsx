import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { RoleDrawerItem } from '../shared/navigation/roleDrawerModel';
import type { AdminDrawerDestination } from './adminDrawerModel';

export type AdminDrawerPresentation = {
  title: string;
  active: string;
  destinations: readonly AdminDrawerDestination[];
  items: readonly RoleDrawerItem[];
  width?: number;
};
const Presentation = createContext<AdminDrawerPresentation | null>(null);
const Registration = createContext<((value: AdminDrawerPresentation) => () => void) | null>(null);

/** The focused native page selects the contents of the one real shell drawer. */
export function AdminDrawerPresentationProvider({ children }: { children: ReactNode }) {
  const leases = useRef(new Map<object, AdminDrawerPresentation>());
  const [presentation, setPresentation] = useState<AdminDrawerPresentation | null>(null);
  const register = useCallback((value: AdminDrawerPresentation) => {
    const key = {};
    leases.current.set(key, value);
    setPresentation(value);
    return () => {
      leases.current.delete(key);
      setPresentation(Array.from(leases.current.values()).at(-1) ?? null);
    };
  }, []);
  return <Registration.Provider value={register}><Presentation.Provider value={presentation}>{children}</Presentation.Provider></Registration.Provider>;
}
export const useAdminDrawerPresentation = () => useContext(Presentation);
export const useAdminDrawerRegistration = () => useContext(Registration);
