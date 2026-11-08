import type { Session } from '../auth';
import type { DispatchRecord } from '../shared/notificationApi';
import { supplierNotificationItems } from './supplierScreenModel';
import type { SupplierStore } from './supplierStore';

type Listener = () => void;
export type HiddenNotifications = {
  load: () => Promise<void>;
  hiddenIdsForProfile: (session: Session | null) => Set<string>;
  hideAll: (session: Session | null, ids: Iterable<string>) => Promise<void>;
};
export type UnreadNotifications = {
  load: () => Promise<void>;
  unreadIdsForProfile: (session: Session | null) => Set<string>;
  markSeen: (session: Session | null, ids: Iterable<string>) => Promise<void>;
  retainForProfile: (session: Session | null, ids: Iterable<string>) => Promise<void>;
};

/** SupplierNotificationsScreen's local hidden/unread synchronization. */
export class SupplierNotificationsController {
  private readonly listeners = new Set<Listener>();
  private highlighted = new Set<string>();
  private version = 0;
  private active = false;
  private unsubscribeStore: (() => void) | null = null;
  constructor(private readonly session: Session, private readonly store: SupplierStore,
    private readonly hidden: HiddenNotifications, private readonly unread: UnreadNotifications,
    private onOpenReceipt: (id: string) => void) {}
  subscribe = (listener: Listener): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = (): number => this.version;
  setOnOpenReceipt(callback: (id: string) => void): void { this.onOpenReceipt = callback; }
  private notify(): void { this.version++; for (const listener of this.listeners) listener(); }
  get highlightedIds(): ReadonlySet<string> { return this.highlighted; }
  get visibleItems(): DispatchRecord[] {
    return supplierNotificationItems(this.store.historyItems, this.hidden.hiddenIdsForProfile(this.session), this.highlighted);
  }
  start(): void {
    this.active = true;
    void this.hidden.load().then(() => { if (this.active) this.notify(); });
    void this.unread.load().then(() => { if (this.active) this.syncHighlighted(); });
    this.unsubscribeStore = this.store.subscribe(() => { void this.syncFromStore(); });
  }
  stop(): void { this.active = false; this.unsubscribeStore?.(); this.unsubscribeStore = null; }
  private applyHighlighted(next: Set<string>): void {
    if (!this.active || (next.size === this.highlighted.size && [...next].every(id => this.highlighted.has(id)))) return;
    this.highlighted = next; this.notify();
  }
  private syncHighlighted(): void {
    const unread = this.unread.unreadIdsForProfile(this.session);
    this.applyHighlighted(new Set(this.store.historyItems.map(item => item.id).filter(id => unread.has(id))));
  }
  async syncFromStore(): Promise<void> {
    const items = this.store.historyItems, hidden = this.hidden.hiddenIdsForProfile(this.session);
    if (hidden.size) await this.unread.markSeen(this.session, hidden);
    await this.unread.retainForProfile(this.session, items.map(item => item.id));
    if (this.active) this.syncHighlighted();
  }
  async reload(): Promise<void> { await this.store.refreshHistory(); await this.syncFromStore(); }
  async clearAll(): Promise<void> {
    const ids = this.store.historyItems.map(item => item.id);
    await this.hidden.hideAll(this.session, ids);
    await this.unread.markSeen(this.session, ids);
    if (!this.active) return;
    this.highlighted = new Set(); this.notify();
  }
  async open(id: string): Promise<void> {
    await this.unread.markSeen(this.session, [id]);
    if (!this.active) return;
    this.highlighted.delete(id); this.notify(); this.onOpenReceipt(id);
  }
}
