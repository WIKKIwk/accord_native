import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AdminRootRouterBinding } from './AdminRootRouterTypes';
import type { AdminRootRouterController } from './adminRootRouterController';

type Value = Readonly<{ controller: AdminRootRouterController; binding: AdminRootRouterBinding; isCurrent: () => boolean; canInteract: () => boolean }>;
const Context = createContext<Value | null>(null);
/** Adds physical Root authority around the REAL descriptor; it never replaces navigation/focus/remove contexts. */
export function AdminRootRouterPageProvider({ controller, binding, children }: { controller: AdminRootRouterController; binding: AdminRootRouterBinding; children: ReactNode }) {
  const value = useMemo(() => Object.freeze({ controller, binding, isCurrent: () => controller.readCurrent(binding), canInteract: () => controller.canInteract(binding) }), [controller, binding]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminRootRouterPage() { const value = useContext(Context); if (!value) throw Error('A genuine original Root route descriptor is required'); return value; }
