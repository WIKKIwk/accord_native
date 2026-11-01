import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ChatConversation, ChatPeer } from '../chatModel';

type ChatHeaderMetadata = { title: string; peer: ChatPeer | null };
type ChatMetadataValue = {
  conversations: ReadonlyMap<string, ChatHeaderMetadata>;
  remember: (conversations: ChatConversation[]) => void;
};

const ChatMetadataContext = createContext<ChatMetadataValue | null>(null);

export function ChatMetadataProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ReadonlyMap<string, ChatHeaderMetadata>>(() => new Map());
  const remember = useCallback((items: ChatConversation[]) => {
    setConversations(current => {
      const next = new Map(current);
      for (const item of items) next.set(item.id, { title: item.title, peer: item.peer });
      return next;
    });
  }, []);
  const value = useMemo(() => ({ conversations, remember }), [conversations, remember]);
  return <ChatMetadataContext.Provider value={value}>{children}</ChatMetadataContext.Provider>;
}

export function useChatMetadata() {
  const value = useContext(ChatMetadataContext);
  if (!value) throw new Error('Chat metadata is not available.');
  return value;
}
