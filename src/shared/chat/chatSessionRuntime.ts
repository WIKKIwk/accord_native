import type { ChatConversation, ChatMessage, ChatSyncEvent } from '../../chatModel';
import type { PendingChatReceipt } from './chatLocalStore';
import { ChatReceiptFlusher } from './chatReceiptFlusher';
import { ChatSyncEngine } from './chatSyncEngine';
import { ChatUnreadState } from './chatUnreadState';

type ChatPage = { items: ChatConversation[]; hasMore: boolean };
type MessagePage = { items: ChatMessage[]; hasMore: boolean };
type SyncPage = { events: ChatSyncEvent[]; nextCursor: number; hasMore: boolean };
type RuntimeDependencies = {
  isCurrent: () => boolean;
  loadConversations: () => Promise<ChatConversation[]>;
  saveConversations: (items: readonly ChatConversation[]) => Promise<void>;
  fetchConversations: () => Promise<ChatPage>;
  loadCursor: () => Promise<number>;
  saveCursor: (cursor: number) => Promise<void>;
  loadSync: (cursor: number) => Promise<SyncPage>;
  loadAfter: (conversationId: string, sequence: number) => Promise<MessagePage>;
  latestSavedSequence: (conversationId: string) => Promise<number>;
  saveMessages: (items: readonly ChatMessage[]) => Promise<void>;
  loadReceipts: () => Promise<PendingChatReceipt[]>;
  saveReceipt: (receipt: PendingChatReceipt) => Promise<void>;
  acknowledgeReceipt: (conversationId: string, delivered: number, read: number) => Promise<void>;
  deviceId: () => Promise<string>;
  sendDelivered: (conversationId: string, sequence: number, deviceId: string) => Promise<void>;
  sendRead: (conversationId: string, sequence: number, deviceId: string) => Promise<void>;
  decodeRealtimeMessage: (payload: Record<string, unknown>) => ChatMessage | null;
  subscribeLive: (onEvent: (payload: Record<string, unknown>) => void) => () => void;
  scheduleRecovery: (callback: () => void) => () => void;
  abort: () => void;
};

/** Session-scoped composition of the V2 unread, sync and receipt rules. */
export class ChatSessionRuntime {
  private readonly unread: ChatUnreadState;
  private readonly flusher: ChatReceiptFlusher;
  private engine: ChatSyncEngine | null = null;
  private startOperation: Promise<void> | null = null;
  private refreshOperation: Promise<void> | null = null;
  private refreshRequested = false;
  private stopLive: (() => void) | null = null;
  private stopTimer: (() => void) | null = null;
  private foreground: boolean;
  private activeConversation = '';
  private closed = false;

  constructor(identity: { role: string; ref: string }, private readonly deps: RuntimeDependencies, foreground = true) {
    this.foreground = foreground;
    this.unread = new ChatUnreadState(identity);
    this.flusher = new ChatReceiptFlusher({
      isCurrent: () => this.current(), deviceId: deps.deviceId, load: deps.loadReceipts,
      delivered: deps.sendDelivered, read: deps.sendRead, acknowledge: deps.acknowledgeReceipt,
    });
  }

  get value(): number { return this.unread.value; }
  subscribe = (listener: () => void): (() => void) => this.unread.subscribe(listener);
  getSnapshot = (): number => this.unread.value;

  start(): Promise<void> {
    if (!this.current() || this.engine) return Promise.resolve();
    if (this.startOperation) return this.startOperation;
    let operation!: Promise<void>;
    operation = this.startSession().finally(() => { if (this.startOperation === operation) this.startOperation = null; });
    this.startOperation = operation;
    return operation;
  }

  private async startSession(): Promise<void> {
    try {
      const cached = await this.deps.loadConversations();
      if (!this.current()) return;
      this.unread.replaceConversations(cached);
    } catch { /* V2 continues without cached conversations. */ }
    if (!this.current()) return;
    let cursor = 0;
    try { cursor = await this.deps.loadCursor(); } catch { /* V2 starts recovery at cursor zero. */ }
    if (!this.current()) return;
    this.engine = new ChatSyncEngine({
      isCurrent: () => this.current(), loadSync: this.deps.loadSync, loadAfter: this.deps.loadAfter,
      latestSavedSequence: this.deps.latestSavedSequence, saveMessages: this.deps.saveMessages,
      saveConversations: this.deps.saveConversations, saveCursor: this.deps.saveCursor,
      rememberMessages: items => this.unread.rememberMessages(items), acceptMessage: item => this.unread.acceptMessage(item),
      queueDelivered: (id, sequence) => this.queueReceipt(id, sequence, 0),
      refreshConversations: () => this.refresh(), activeConversationId: () => this.activeConversation,
      markRead: id => this.markRead(id), flushReceipts: () => this.flusher.flush(),
    }, cursor);
    if (this.activeConversation) this.setActiveConversation(this.activeConversation);
    if (this.foreground) {
      this.attachLive();
      void this.recover();
      void this.refresh();
    }
  }

  /** V2 keeps the prior list when refresh fails and coalesces overlapping refreshes. */
  refresh(): Promise<void> {
    if (!this.current()) return Promise.resolve();
    if (this.refreshOperation) { this.refreshRequested = true; return this.refreshOperation; }
    let operation!: Promise<void>;
    operation = this.runRefresh().then(async () => {
      if (this.refreshOperation === operation) this.refreshOperation = null;
      if (this.refreshRequested && this.current()) await this.refresh();
    }, error => {
      if (this.refreshOperation === operation) this.refreshOperation = null;
      throw error;
    });
    this.refreshOperation = operation;
    return operation;
  }

  private async runRefresh(): Promise<void> {
    do {
      this.refreshRequested = false;
      try {
        const page = await this.deps.fetchConversations();
        if (!this.current()) return;
        this.unread.replaceConversations(page.items);
        try { await this.deps.saveConversations(page.items); } catch { /* Keep the in-memory result. */ }
      } catch { /* Keep the last cached or successfully loaded list. */ }
    } while (this.refreshRequested && this.current());
  }

  setActiveConversation(conversationId: string): void {
    if (!this.current()) return;
    this.activeConversation = conversationId;
    const updated = this.unread.setActiveConversation(conversationId);
    if (updated) void this.deps.saveConversations([updated]).catch(() => {});
    if (conversationId) void this.markRead(conversationId).catch(() => {});
  }

  /** Called by the existing thread after it loads real messages. */
  async rememberThreadMessages(conversationId: string, items: readonly ChatMessage[]): Promise<void> {
    await this.start();
    if (!this.current() || !this.engine) return;
    this.engine.rememberMessages(items);
    try { await this.deps.saveMessages(items); } catch { /* V2 still attempts the read receipt. */ }
    if (this.current()) await this.markRead(conversationId);
  }

  private async markRead(conversationId: string): Promise<void> {
    if (!this.current()) return;
    const updated = this.unread.markRead(conversationId);
    if (updated) void this.deps.saveConversations([updated]).catch(() => {});
    const sequence = this.engine?.latestInMemorySequence(conversationId) ?? 0;
    if (sequence <= 0) return;
    await this.queueReceipt(conversationId, sequence, sequence);
    if (this.current()) void this.flusher.flush().catch(() => {});
  }

  private async queueReceipt(conversationId: string, deliveredSequence: number, readSequence: number): Promise<void> {
    if (!this.current() || !conversationId) return;
    await this.deps.saveReceipt({ conversationId, deliveredSequence, readSequence });
    if (this.current()) this.flusher.receiptQueued();
  }

  private async recover(): Promise<void> {
    if (!this.current() || !this.engine) return;
    try { await this.engine.synchronize(); } catch { /* Retry on the next live event or recovery interval. */ }
    if (!this.current()) return;
    try { await this.flusher.flush(); } catch { /* Pending receipts stay in local storage. */ }
  }

  private attachLive(): void {
    if (!this.current() || !this.foreground || !this.engine) return;
    if (!this.stopLive) this.stopLive = this.deps.subscribeLive(payload => this.handleLive(payload));
    if (!this.stopTimer) this.stopTimer = this.deps.scheduleRecovery(() => { void this.recover(); });
  }

  private handleLive(payload: Record<string, unknown>): void {
    if (!this.current() || !this.foreground || !this.engine) return;
    if (payload.event === 'chat.ready' || payload.event === 'chat.resync_required') { void this.recover(); return; }
    if (payload.event !== 'chat.message.created' && payload.event !== 'chat.message.updated') return;
    const message = this.deps.decodeRealtimeMessage(payload);
    if (message) void this.engine.acceptRealtimeMessage(message).catch(() => {});
    else void this.recover();
  }

  resume(): void {
    if (!this.current()) return;
    this.foreground = true;
    if (!this.engine) { void this.start(); return; }
    this.attachLive();
    void this.recover();
    void this.refresh();
  }

  pause(): void {
    this.foreground = false;
    this.stopLive?.(); this.stopLive = null;
    this.stopTimer?.(); this.stopTimer = null;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pause();
    this.deps.abort();
    this.unread.close();
  }

  private current(): boolean { return !this.closed && this.deps.isCurrent(); }
}
