import type { Session } from '../../auth';
import type { ChatConversation, ChatPeer } from '../../chatModel';

export type ChatNavigation = {
  openDirectory: () => void;
  openConversation: (conversation: ChatConversation) => void;
  replaceConversation: (conversation: ChatConversation) => void;
};
export type ChatConversationsProps = { session: Session; navigation: ChatNavigation; onOpenDrawer?: () => void; onBack?: () => void };
export type ChatDirectoryProps = { session: Session; onOpenConversation: (conversation: ChatConversation) => void };
export type ChatThreadProps = { session: Session; conversationId: string; title: string; peer: ChatPeer | null };
