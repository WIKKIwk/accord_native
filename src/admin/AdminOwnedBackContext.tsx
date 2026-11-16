import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';

export type AdminOwnedBackHandler = () => void | boolean;
export type AdminOwnedBackRegistration = (handler: AdminOwnedBackHandler) => () => void;
const Context = createContext<AdminOwnedBackRegistration | null>(null);

/** Native route removal reaches the real source detail model, including its current changed flag/overlays. */
export function AdminOwnedBackProvider({ register, children }: { register: AdminOwnedBackRegistration; children: ReactNode }) {
  return <Context.Provider value={register}>{children}</Context.Provider>;
}
export function useAdminOwnedBack(handler: AdminOwnedBackHandler): void {
  const register = useContext(Context);
  useLayoutEffect(() => register?.(handler), [register, handler]);
}
