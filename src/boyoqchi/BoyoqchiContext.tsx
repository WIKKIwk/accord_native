import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Session } from '../auth';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
type Value = { session: Session; onLogout: () => void; unread: number; chatClosing: boolean; setChatClosing: (closing: boolean) => void };
const Context = createContext<Value | null>(null);
export function BoyoqchiProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const unread = useChatUnreadCount(session), [chatClosing, setChatClosing] = useState(false);
  return <Context.Provider value={{ session, onLogout, unread, chatClosing, setChatClosing }}>{children}</Context.Provider>;
}
export function useBoyoqchiContext() {
  const value = useContext(Context);
  if (!value) throw new Error('Boyoqchi session unavailable');
  return value;
}
