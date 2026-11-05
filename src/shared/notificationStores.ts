import type { Session } from '../auth';
import type { AccountStorage } from '../savedAccountStore';
import { sessionAccessRole } from './searchActivityStore';

type CurrentSession = () => Session | null;
class StoredIdSets {
  private readonly byUser = new Map<string, Set<string>>();
  private loaded = false;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage: AccountStorage, private readonly prefKey: string, private readonly current: CurrentSession) {}
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
  key(session: Session | null): string | null {
    const current = session ?? this.current();
    return current ? `${sessionAccessRole(current) ?? 'custom'}:${String(current.profile.ref ?? '')}` : null;
  }
  async load(): Promise<void> {
    if (this.loaded) return;
    const raw = await this.storage.getItem(this.prefKey);
    if (raw?.trim()) {
      const decoded: unknown = JSON.parse(raw);
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new TypeError('Invalid notification state');
      for (const [key, value] of Object.entries(decoded)) {
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new TypeError('Invalid notification IDs');
        this.byUser.set(key, new Set(value as string[]));
      }
    }
    this.loaded = true;
  }
  ids(session: Session | null): Set<string> {
    const key = this.key(session);
    return new Set(key == null ? [] : this.byUser.get(key) ?? []);
  }
  async add(session: Session | null, ids: Iterable<string>): Promise<void> {
    const key = this.key(session); if (key == null) return;
    await this.load();
    let set = this.byUser.get(key);
    if (!set) { set = new Set(); this.byUser.set(key, set); }
    let changed = false;
    for (const id of ids) { const value = id.trim(); if (value && !set.has(value)) { set.add(value); changed = true; } }
    if (changed) await this.persist();
  }
  async remove(session: Session | null, ids: Iterable<string>, ignoreEmpty = true): Promise<Set<string>> {
    const key = this.key(session); if (key == null) return new Set();
    await this.load();
    const set = this.byUser.get(key); if (!set?.size) return new Set();
    const normalized = [...ids].map(id => id.trim());
    const requested = new Set(ignoreEmpty ? normalized.filter(Boolean) : normalized);
    const removed = new Set([...set].filter(id => requested.has(id)));
    if (!removed.size) return removed;
    for (const id of removed) set.delete(id);
    if (!set.size) this.byUser.delete(key);
    await this.persist(); return removed;
  }
  async retain(session: Session | null, ids: Iterable<string>): Promise<void> {
    const key = this.key(session); if (key == null) return;
    await this.load();
    const set = this.byUser.get(key); if (!set?.size) return;
    const allowed = new Set([...ids].map(id => id.trim()).filter(Boolean));
    const kept = new Set([...set].filter(id => allowed.has(id)));
    if (kept.size === set.size) return;
    if (kept.size) this.byUser.set(key, kept); else this.byUser.delete(key);
    await this.persist();
  }
  async clearAll(): Promise<void> {
    this.byUser.clear(); this.loaded = true;
    await this.storage.removeItem(this.prefKey); this.notify();
  }
  private async persist(): Promise<void> {
    const result: Record<string, string[]> = {};
    for (const [key, values] of this.byUser) result[key] = [...values].sort();
    await this.storage.setItem(this.prefKey, JSON.stringify(result)); this.notify();
  }
}

/** @v2 NotificationHiddenStore */
export class NotificationHiddenStore {
  private readonly values: StoredIdSets;
  constructor(storage: AccountStorage, current: CurrentSession) { this.values = new StoredIdSets(storage, 'notification_hidden_v1', current); }
  load(): Promise<void> { return this.values.load(); }
  subscribe(listener: () => void): () => void { return this.values.subscribe(listener); }
  hiddenIdsForProfile(session: Session | null): Set<string> { return this.values.ids(session); }
  hideAll(session: Session | null, ids: Iterable<string>): Promise<void> { return this.values.add(session, ids); }
  clearAll(): Promise<void> { return this.values.clearAll(); }
}

/** @v2 NotificationUnreadStore */
export class NotificationUnreadStore {
  private readonly values: StoredIdSets;
  constructor(storage: AccountStorage, current: CurrentSession) { this.values = new StoredIdSets(storage, 'notification_unread_v1', current); }
  load(): Promise<void> { return this.values.load(); }
  subscribe(listener: () => void): () => void { return this.values.subscribe(listener); }
  unreadIdsForProfile(session: Session | null): Set<string> { return this.values.ids(session); }
  hasUnreadForProfile(session: Session | null): boolean { return this.values.ids(session).size > 0; }
  markUnread(session: Session | null, ids: Iterable<string>): Promise<void> { return this.values.add(session, ids); }
  async markSeen(session: Session | null, ids: Iterable<string>): Promise<void> { await this.values.remove(session, ids, false); }
  consumeUnread(session: Session | null, ids: Iterable<string>): Promise<Set<string>> { return this.values.remove(session, ids); }
  retainForProfile(session: Session | null, ids: Iterable<string>): Promise<void> { return this.values.retain(session, ids); }
  clearAll(): Promise<void> { return this.values.clearAll(); }
}

/** @v2 RefreshHub */
export class RefreshHub {
  topic = '';
  version = 0;
  private readonly listeners = new Set<() => void>();
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(topic: string): void { this.topic = topic; this.version++; for (const listener of this.listeners) listener(); }
}
