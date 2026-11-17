import { createContext,useContext,useEffect,useMemo,type ReactNode } from 'react';
import { useAdminShell } from '../admin/AdminShellContext';
import { CalculateOrderTemplateStore,calculateOrderTemplateClient } from '../admin/calculateOrderTemplateStore';
import { sessionReadScope } from '../sessionReadScope';
class StoreLease{private leases=0;constructor(readonly store:CalculateOrderTemplateStore){}mount=()=>{this.leases++;return()=>{this.leases--;queueMicrotask(()=>{if(!this.leases)this.store.dispose();});};};}
const Context=createContext<CalculateOrderTemplateStore|null>(null);
export function BrigaderCalculateStoreProvider({children}:{children:ReactNode}){const shell=useAdminShell(),owner=useMemo(()=>{const scope=sessionReadScope(shell.session),guard=()=>{if(!shell.isCurrent()||scope!==sessionReadScope(shell.session))throw new Error('Calculate account expired');};return new StoreLease(new CalculateOrderTemplateStore({client:calculateOrderTemplateClient(shell.session,guard),readScope:()=>scope}));},[shell]);useEffect(()=>owner.mount(),[owner]);return <Context.Provider value={owner.store}>{children}</Context.Provider>;}
export function useBrigaderCalculateStore(){const store=useContext(Context);if(!store)throw new Error('Original Brigader calculation store is required');return store;}
