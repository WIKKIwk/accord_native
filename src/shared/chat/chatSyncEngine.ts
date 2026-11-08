import type { ChatConversation, ChatMessage, ChatSyncEvent } from '../../chatModel';

type MessagePage = { items: ChatMessage[]; hasMore: boolean };
type SyncPage = { events: ChatSyncEvent[]; nextCursor: number; hasMore: boolean };
type SyncDependencies = {
  isCurrent: () => boolean;
  loadSync: (cursor: number) => Promise<SyncPage>;
  loadAfter: (conversationId: string, sequence: number) => Promise<MessagePage>;
  latestSavedSequence: (conversationId: string) => Promise<number>;
  saveMessages: (messages: readonly ChatMessage[]) => Promise<void>;
  saveConversations: (conversations: readonly ChatConversation[]) => Promise<void>;
  saveCursor: (cursor: number) => Promise<void>;
  rememberMessages: (messages: readonly ChatMessage[]) => void;
  acceptMessage: (message: ChatMessage) => ChatConversation | null;
  queueDelivered: (conversationId: string, sequence: number) => Promise<void>;
  refreshConversations: () => Promise<void>;
  activeConversationId: () => string;
  markRead: (conversationId: string) => Promise<void>;
  flushReceipts: () => Promise<void>;
};

/** Source: V2 ChatStore._synchronizeChat. */
export class ChatSyncEngine {
  private readonly messages = new Map<string, ChatMessage[]>();
  private operation: Promise<void> | null = null;
  private cursor: number;

  constructor(private readonly deps: SyncDependencies, cursor = 0) { this.cursor = cursor; }

  /** V2 keeps the in-memory timeline as well as its on-disk message history. */
  rememberMessages(items: readonly ChatMessage[]): void {
    if (!this.deps.isCurrent()) return;
    for (const item of items) this.mergeMessage(item);
    this.deps.rememberMessages(items);
  }

  latestInMemorySequence(conversationId: string): number {
    return this.messages.get(conversationId)?.at(-1)?.sequence ?? 0;
  }

  synchronize(): Promise<void> {
    if (!this.deps.isCurrent()) return Promise.resolve();
    if (this.operation) return this.operation;
    let operation!: Promise<void>;
    operation = this.runSynchronization().finally(() => { if (this.operation === operation) this.operation = null; });
    this.operation = operation;
    return operation;
  }

  /** Source: V2 ChatStore._acceptRealtimeMessage. */
  async acceptRealtimeMessage(message: ChatMessage): Promise<void> {
    if (!this.deps.isCurrent()) return;
    await this.fillMessageGap(message.conversationId, message.sequence);
    if (!this.deps.isCurrent()) return;
    await this.acceptMessage(message, false);
    if (!this.deps.isCurrent()) return;
    await this.deps.queueDelivered(message.conversationId, message.sequence);
    if (!this.deps.isCurrent()) return;
    if (message.conversationId === this.deps.activeConversationId()) await this.deps.markRead(message.conversationId);
    else void this.deps.flushReceipts().catch(() => {});
    if (!this.deps.isCurrent()) return;
    void this.deps.refreshConversations().catch(() => {});
    void this.synchronize().catch(() => {});
  }

  private async runSynchronization(): Promise<void> {
    let cursor = this.cursor;
    let changed = false;
    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      if (!this.deps.isCurrent()) return;
      const page = await this.deps.loadSync(cursor);
      if (!this.deps.isCurrent()) return;
      for (const event of page.events) {
        if ((event.event !== 'chat.message.created' && event.event !== 'chat.message.updated') || !event.message) continue;
        const message = event.message;
        changed = (await this.fillMessageGap(message.conversationId, message.sequence)) || changed;
        if (!this.deps.isCurrent()) return;
        await this.acceptMessage(message, true);
        changed = true;
        if (!this.deps.isCurrent()) return;
        await this.deps.queueDelivered(message.conversationId, message.sequence);
        if (!this.deps.isCurrent()) return;
      }
      const previous = cursor;
      const next = Math.max(cursor, page.nextCursor);
      if (next !== previous) {
        cursor = next;
        this.cursor = cursor;
        await this.deps.saveCursor(cursor);
        if (!this.deps.isCurrent()) return;
      }
      if (!page.hasMore || (next === previous && page.events.length === 0)) break;
    }
    if (!this.deps.isCurrent()) return;
    if (changed) await this.deps.refreshConversations();
    if (!this.deps.isCurrent()) return;
    const active = this.deps.activeConversationId();
    if (active) await this.deps.markRead(active);
    if (this.deps.isCurrent()) await this.deps.flushReceipts();
  }

  /** Source: V2 ChatStore._fillMessageGap. */
  private async fillMessageGap(conversationId: string, incomingSequence: number): Promise<boolean> {
    if (!this.deps.isCurrent()) return false;
    const knownSequence = this.latestInMemorySequence(conversationId);
    if (incomingSequence <= knownSequence + 1) return false;
    return this.syncConversationAfterKnown(conversationId);
  }

  /** Source: V2 ChatStore._syncConversationAfterKnown. */
  private async syncConversationAfterKnown(conversationId: string): Promise<boolean> {
    if (!this.deps.isCurrent() || !conversationId) return false;
    let cursor = this.latestInMemorySequence(conversationId);
    if (cursor === 0) {
      cursor = await this.deps.latestSavedSequence(conversationId);
      if (!this.deps.isCurrent()) return false;
    }
    let changed = false;
    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      const page = await this.deps.loadAfter(conversationId, cursor);
      if (!this.deps.isCurrent()) return false;
      if (!page.items.length) break;
      const known = new Set((this.messages.get(conversationId) ?? []).map(message => message.id));
      changed = page.items.some(message => !known.has(message.id)) || changed;
      this.rememberMessages(page.items);
      await this.deps.saveMessages(page.items);
      if (!this.deps.isCurrent()) return false;
      for (const message of page.items) {
        await this.deps.queueDelivered(conversationId, message.sequence);
        if (!this.deps.isCurrent()) return false;
      }
      const next = page.items.at(-1)!.sequence;
      if (next <= cursor) break;
      cursor = next;
      if (!page.hasMore) break;
    }
    return changed;
  }

  /** Source: V2 ChatStore._acceptMessage. */
  private async acceptMessage(message: ChatMessage, requirePersistence: boolean): Promise<void> {
    if (!this.deps.isCurrent()) return;
    const updatedConversation = this.deps.acceptMessage(message);
    this.mergeMessage(message);
    try {
      await this.deps.saveMessages([message]);
      if (!this.deps.isCurrent()) return;
      if (updatedConversation) await this.deps.saveConversations([updatedConversation]);
    } catch (error) {
      if (requirePersistence) throw error;
    }
  }

  private mergeMessage(message: ChatMessage): void {
    const byId = new Map((this.messages.get(message.conversationId) ?? []).map(item => [item.id, item]));
    byId.set(message.id, message);
    this.messages.set(message.conversationId, [...byId.values()].sort((a, b) => a.sequence - b.sequence));
  }
}
