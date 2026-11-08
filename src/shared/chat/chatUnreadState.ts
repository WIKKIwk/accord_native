import type { ChatConversation, ChatMessage } from '../../chatModel';

type UnreadConversation = Pick<ChatConversation, 'id' | 'lastMessageSequence' | 'unreadCount'>;
type UnreadMessage = Pick<ChatMessage, 'id' | 'conversationId' | 'sequence' | 'senderRole' | 'senderRef'>;
type ChatIdentity = { role: string; ref: string };

/**
 * The unread portion of V2 ChatStore. A runtime owns one instance for one
 * session and must stop its asynchronous work before discarding that instance.
 * The input conversations have already passed V2's hasMessages filter.
 *
 * @v2 ChatStore
 */
export class ChatUnreadState {
  private conversations: UnreadConversation[] = [];
  private readonly knownMessages = new Map<string, Set<string>>();
  private readonly listeners = new Set<() => void>();
  private activeConversationId = '';
  private total = 0;
  private closed = false;

  constructor(private readonly identity: ChatIdentity) {}

  get value(): number { return this.total; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** A successful cache restore or server refresh replaces the visible list. */
  replaceConversations(items: readonly UnreadConversation[]): void {
    if (this.closed) return;
    this.conversations = items.map(item => ({ ...item }));
    this.publish();
  }

  /** Gap/history loading makes these message IDs known before later events. */
  rememberMessages(items: readonly UnreadMessage[]): void {
    if (this.closed) return;
    for (const item of items) this.remember(item);
  }

  /** Mirrors setActiveConversation and its immediate local markRead. */
  setActiveConversation(conversationId: string): void {
    if (this.closed) return;
    this.activeConversationId = conversationId;
    if (conversationId) this.markRead(conversationId);
  }

  /** V2 clears the local count before attempting to deliver its receipt. */
  markRead(conversationId: string): void {
    if (this.closed) return;
    const index = this.conversations.findIndex(item => item.id === conversationId);
    if (index < 0 || this.conversations[index].unreadCount === 0) return;
    this.conversations[index] = { ...this.conversations[index], unreadCount: 0 };
    this.publish();
  }

  /** Applies V2's known-message, sender and active-conversation rules. */
  acceptMessage(message: UnreadMessage): void {
    if (this.closed) return;
    const alreadyKnown = this.knownMessages.get(message.conversationId)?.has(message.id) ?? false;
    this.remember(message);
    const index = this.conversations.findIndex(item => item.id === message.conversationId);
    if (index < 0) return;
    const current = this.conversations[index];
    const mine = message.senderRole === this.identity.role && message.senderRef === this.identity.ref;
    const unreadCount = message.conversationId === this.activeConversationId ? 0
      : !alreadyKnown && !mine ? current.unreadCount + 1 : current.unreadCount;
    this.conversations[index] = {
      ...current,
      lastMessageSequence: message.sequence >= current.lastMessageSequence ? message.sequence : current.lastMessageSequence,
      unreadCount,
    };
    this.publish();
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
