import { createContext, useContext, type ReactNode } from 'react';

export type ChatLivePolicy = 'legacy' | 'secure';
const Context = createContext<ChatLivePolicy>('legacy');

/** New role routes choose this before any child Chat hook can run. */
export function ChatLivePolicyProvider({ policy, children }: { policy: ChatLivePolicy; children: ReactNode }) {
  return <Context.Provider value={policy}>{children}</Context.Provider>;
}
export function useChatLivePolicy(): ChatLivePolicy { return useContext(Context); }
