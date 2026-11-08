import type { ChatConversation, ChatMessage } from '../../chatModel';

type UnreadMessage = Pick<ChatMessage, 'id' | 'conversationId' | 'sequence' | 'senderRole' | 'senderRef' | 'timestamp'>;
type ChatIdentity = { role: string; ref: string };
const copyConversation = (item: ChatConversation): ChatConversation => ({ ...item, peer: item.peer ? { ...item.peer } : null });

/**
 * The unread portion of V2 ChatStore. A runtime owns one instance for one
 * session and must stop its asynchronous work before discarding that instance.
 * The input conversations have already passed V2's hasMessages filter.
 *
 * Source: V2 ChatStore.
 */
export class ChatUnreadState {
  private conversations: ChatConversation[] = [];
  private readonly knownMessages = new Map<string, Set<string>>();
  private readonly listeners = new Set<() => void>();
  private activeConversationId = '';
  private total = 0;
  private closed = false;

  constructor(private readonly identity: ChatIdentity) {}

  get value(): number { return this.total; }

  snapshot(): ChatConversation[] { return this.conversations.map(copyConversation); }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** A successful cache restore or server refresh replaces the visible list. */
  replaceConversations(items: readonly ChatConversation[]): void {
    if (this.closed) return;
    this.conversations = items.map(copyConversation);
    this.publish();
  }

  /** Gap/history loading makes these message IDs known before later events. */
  rememberMessages(items: readonly UnreadMessage[]): void {
    if (this.closed) return;
    for (const item of items) this.remember(item);
  }

  /** Mirrors setActiveConversation and its immediate local markRead. */
  setActiveConversation(conversationId: string): ChatConversation | null {
    if (this.closed) return null;
    this.activeConversationId = conversationId;
    return conversationId ? this.markRead(conversationId) : null;
  }

  /** V2 clears the local count before attempting to deliver its receipt. */
  markRead(conversationId: string): ChatConversation | null {
    if (this.closed) return null;
    const index = this.conversations.findIndex(item => item.id === conversationId);
    if (index < 0 || this.conversations[index].unreadCount === 0) return null;
    this.conversations[index] = { ...this.conversations[index], unreadCount: 0 };
    this.publish();
    return copyConversation(this.conversations[index]);
  }

  /** Applies V2's known-message, sender and active-conversation rules. */
  acceptMessage(message: UnreadMessage): ChatConversation | null {
    if (this.closed) return null;
    const alreadyKnown = this.knownMessages.get(message.conversationId)?.has(message.id) ?? false;
    this.remember(message);
    const index = this.conversations.findIndex(item => item.id === message.conversationId);
    if (index < 0) return null;
    const current = this.conversations[index];
    const mine = message.senderRole === this.identity.role && message.senderRef === this.identity.ref;
    const latest = message.sequence >= current.lastMessageSequence;
    const unreadCount = message.conversationId === this.activeConversationId ? 0
      : !alreadyKnown && !mine ? current.unreadCount + 1 : current.unreadCount;
    this.conversations[index] = {
      ...current,
      lastMessageSequence: latest ? message.sequence : current.lastMessageSequence,
      updatedAt: latest ? message.timestamp : current.updatedAt,
      timestamp: latest ? message.timestamp : current.timestamp,
      unreadCount,
    };
    this.publish();
    return copyConversation(this.conversations[index]);
  }

  /** Prevent late work from publishing state after a logout or account switch. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.activeConversationId = '';
    this.conversations = [];
    this.knownMessages.clear();
    this.publish();
  }

  private remember(message: UnreadMessage): void {
    let known = this.knownMessages.get(message.conversationId);
    if (!known) { known = new Set(); this.knownMessages.set(message.conversationId, known); }
    known.add(message.id);
  }

  private publish(): void {
    const next = this.conversations.reduce((total, item) => total + item.unreadCount, 0);
    if (next === this.total) return;
    this.total = next;
    for (const listener of this.listeners) listener();
  }
}
