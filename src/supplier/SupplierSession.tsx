import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Session } from '../auth';
import { supplierRuntimeStore } from '../shared/notificationStoresRuntime';
import * as api from './supplierApi';
import { SupplierFlowStore } from './supplierFlowStore';
import { SupplierStore } from './supplierStore';

type SupplierContext = { session: Session; store: SupplierStore; flow: SupplierFlowStore; onLogout: () => void;
  chatClosing: boolean; setChatClosing: (value: boolean) => void };
const Context = createContext<SupplierContext | null>(null);

export function SupplierProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const store = useMemo(() => new SupplierStore(session, api, supplierRuntimeStore), [session]);
  const flow = useMemo(() => new SupplierFlowStore(session.imageCacheScope), [session.imageCacheScope]);
  const [chatClosing, setChatClosing] = useState(false);
  useEffect(() => { store.activate(); return () => store.dispose(); }, [store]);
  return <Context.Provider value={{ session, store, flow, onLogout, chatClosing, setChatClosing }}>{children}</Context.Provider>;
}

export function useSupplierSession(): SupplierContext {
  const value = useContext(Context);
  if (!value) throw new Error('Supplier session is unavailable');
  return value;
}

export function useSupplierFlow() {
  const { flow } = useSupplierSession();
  return useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
}
