import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { useMaterialTasksWarmup } from './materialTasksRuntime';

type MaterialContextValue = { session: Session; witness: SessionWitness; onLogout(): void;
  unread: number; chatClosing: boolean; setChatClosing(closing: boolean): void };
const MaterialContext = createContext<MaterialContextValue | null>(null);
export function MaterialProvider({ session, witness, onLogout, children }: Pick<MaterialContextValue, 'session' | 'witness' | 'onLogout'> & { children: ReactNode }) {
  useMaterialTasksWarmup(session, witness);
  const unread = useChatUnreadCount(session), [chatClosing, setChatClosing] = useState(false);
  return <MaterialContext.Provider value={{ session, witness, onLogout, unread, chatClosing, setChatClosing }}>{children}</MaterialContext.Provider>;
}
export function useMaterialContext() {
  const value = useContext(MaterialContext);
  if (!value) throw new Error('Material session unavailable');
  return value;
}
/** Read the actual owner when a shared leaf also accepts an explicit role binding. */
export function useOptionalMaterialContext(){return useContext(MaterialContext);}
