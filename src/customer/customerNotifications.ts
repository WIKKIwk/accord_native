import type { Session } from '../auth';
import type { AccountStorage } from '../savedAccountStore';
import type { DispatchRecord } from '../shared/notificationApi';
import type { NotificationHiddenStore, NotificationUnreadStore, RefreshHub } from '../shared/notificationStores';
import { customerRecordFromJson } from './customerApi';
import type { CustomerStore } from './customerStore';

export const CUSTOMER_NOTIFICATIONS_CACHE = 'cache_customer_notifications';

type Options = {
  session: Session;
  store: CustomerStore;
  storage: Pick<AccountStorage, 'getItem' | 'setItem' | 'removeItem'>;
  hidden: NotificationHiddenStore;
  unread: NotificationUnreadStore;
  refreshHub: RefreshHub;
  schedule: (callback: () => void) => void;
};

/** CustomerNotificationsScreen's cached feed, unread highlights and clear actions. */
export class CustomerNotificationsController {
  private cached: DispatchRecord[] | null = null;
  private highlights = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeRefresh: (() => void) | null = null;
  private refreshVersion = 0;
  private syncScheduled = false;
  private active = false;
  private generation = 0;
  private readonly pendingWrites = new Set<Promise<void>>();
  private _version = 0;
  constructor(private readonly options: Options) {}

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  get version(): number { return this._version; }
  private notify(): void { this._version++; for (const listener of this.listeners) listener(); }

  get highlightedIds(): ReadonlySet<string> { return this.highlights; }
  get items(): DispatchRecord[] {
    const source = this.options.store.loaded ? this.options.store.historyItems : this.cached ?? [];
    const hidden = this.options.hidden.hiddenIdsForProfile(this.options.session);
    const visible = source.filter(item => !hidden.has(item.id));
    return [...visible.filter(item => this.highlights.has(item.id)), ...visible.filter(item => !this.highlights.has(item.id))];
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    const generation = ++this.generation;
    void this.options.store.bootstrap();
    void this.options.hidden.load().then(() => { if (this.current(generation)) this.notify(); }).catch(() => {});
    void this.options.unread.load().then(() => { if (this.current(generation)) this.syncHighlights(); }).catch(() => {});
    void this.loadCache(generation).catch(() => {});
    this.unsubscribeStore = this.options.store.subscribe(() => this.scheduleSync());
    this.unsubscribeRefresh = this.options.refreshHub.subscribe(() => {
      const hub = this.options.refreshHub;
      if (!this.active || hub.topic !== 'customer' || hub.version === this.refreshVersion) return;
      this.refreshVersion = hub.version;
      this.options.schedule(() => { if (this.current(generation)) void this.reload(); });
    });
  }

  private current(generation: number): boolean { return this.active && this.generation === generation; }

  stop(): void {
    this.active = false;
    this.generation++;
    this.unsubscribeStore?.(); this.unsubscribeStore = null;
    this.unsubscribeRefresh?.(); this.unsubscribeRefresh = null;
    this.syncScheduled = false;
  }

  async loadCache(generation = this.generation): Promise<void> {
    const raw = await this.options.storage.getItem(CUSTOMER_NOTIFICATIONS_CACHE);
    if (!this.current(generation) || raw == null || !raw.trim()) return;
    const decoded: unknown = JSON.parse(raw);
    if (!Array.isArray(decoded)) throw new TypeError('Invalid customer notification cache');
    this.cached = decoded.map(customerRecordFromJson);
    this.syncHighlights();
    this.notify();
  }

  async reload(): Promise<void> {
    await this.options.store.refresh();
    await this.syncFromStore();
  }

  async markDetailSeen(deliveryNoteID: string): Promise<void> {
    const generation = this.generation;
    await this.options.unread.markSeen(this.options.session, [deliveryNoteID]);
    if (!this.current(generation)) return;
    this.highlights.delete(deliveryNoteID);
    this.notify();
  }

  async clearAll(): Promise<void> {
    const generation = this.generation;
    const ids = this.options.store.historyItems.map(item => item.id);
    await this.options.hidden.hideAll(this.options.session, ids);
    await this.options.unread.markSeen(this.options.session, ids);
    if (!this.current(generation)) return;
    this.highlights.clear();
    this.notify();
  }

  private scheduleSync(): void {
    if (!this.active || this.syncScheduled) return;
    this.syncScheduled = true;
    const generation = this.generation;
    this.options.schedule(() => {
      if (!this.current(generation)) return;
      this.syncScheduled = false;
      void this.syncFromStore().catch(() => {});
    });
  }

  async syncFromStore(): Promise<void> {
    const { session, hidden, unread, storage, store } = this.options;
    const generation = this.generation;
    const items = store.historyItems;
    const hiddenIds = hidden.hiddenIdsForProfile(session);
    if (hiddenIds.size) await unread.markSeen(session, hiddenIds);
    await unread.retainForProfile(session, items.map(item => item.id));
    if (!this.current(generation)) return;
    const unreadIds = unread.unreadIdsForProfile(session);
    this.setHighlights(new Set(items.map(item => item.id).filter(id => unreadIds.has(id))));
    const write = storage.setItem(CUSTOMER_NOTIFICATIONS_CACHE, JSON.stringify(items));
    this.pendingWrites.add(write);
    try { await write; } finally { this.pendingWrites.delete(write); }
    if (!this.current(generation)) return;
    this.cached = items;
    this.notify();
  }

  /** V2 clears this cache when the account changes or logs out. */
  async resetSession(): Promise<void> {
    this.stop();
    this.options.store.clear();
    await Promise.allSettled([...this.pendingWrites]);
    await this.options.storage.removeItem(CUSTOMER_NOTIFICATIONS_CACHE);
    this.cached = null;
    this.highlights.clear();
    this.notify();
  }

  private syncHighlights(): void {
    const source = this.options.store.loaded ? this.options.store.historyItems : this.cached ?? [];
    const unreadIds = this.options.unread.unreadIdsForProfile(this.options.session);
    this.setHighlights(new Set(source.map(item => item.id).filter(id => unreadIds.has(id))));
  }

  private setHighlights(next: Set<string>): void {
    if (next.size === this.highlights.size && [...next].every(id => this.highlights.has(id))) return;
    this.highlights = next;
    this.notify();
  }
}
