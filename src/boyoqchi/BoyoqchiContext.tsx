import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import type { BoyoqchiProfileNavigation } from './boyoqchiProfileNavigation';
type Value = { session: Session; witness: SessionWitness; onLogout: () => void; unread: number; chatClosing: boolean; setChatClosing: (closing: boolean) => void;
  profileNavigation: { current: BoyoqchiProfileNavigation | null } };
const Context = createContext<Value | null>(null);
export function BoyoqchiProvider({ session, witness, onLogout, children }: { session: Session; witness: SessionWitness; onLogout: () => void; children: ReactNode }) {
  const [chatClosing, setChatClosing] = useState(false), profileNavigation = useRef<BoyoqchiProfileNavigation | null>(null);
  const unread = useChatUnreadCount(session);
  return <Context.Provider value={{ session, witness, onLogout, unread, chatClosing, setChatClosing, profileNavigation }}>{children}</Context.Provider>;
}
export function useBoyoqchiContext() {
  const value = useContext(Context);
  if (!value) throw new Error('Boyoqchi session unavailable');
  return value;
}
