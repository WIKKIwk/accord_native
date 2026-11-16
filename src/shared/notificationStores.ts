import type { Session } from '../auth';
import type { AccountStorage } from '../savedAccountStore';
import { sessionAccessRole } from './searchActivityStore';

type CurrentSession = () => Session | null;
export type NotificationStateGuard = () => void;
class StoredIdSets {
  private readonly byUser = new Map<string, Set<string>>();
  private loaded = false;
  private generation = 0;
  private writes: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly storage: AccountStorage, private readonly prefKey: string, private readonly current: CurrentSession) {}
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
  key(session: Session | null): string | null {
    const current = session ?? this.current();
    return current ? `${sessionAccessRole(current) ?? 'custom'}:${String(current.profile.ref ?? '')}` : null;
  }
  private check(generation: number, guard?: NotificationStateGuard): void {
    if (generation !== this.generation) throw new Error('Notification state reset');
    guard?.();
    // A guard can synchronously trigger an account reset.
    if (generation !== this.generation) throw new Error('Notification state reset');
  }
  private enqueue<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writes.then(write);
    this.writes = result.then(() => {}, () => {});
    return result;
  }
  async load(guard?: NotificationStateGuard): Promise<void> {
    const generation = this.generation; this.check(generation, guard);
    if (this.loaded) return;
    const raw = await this.storage.getItem(this.prefKey);
    this.check(generation, guard);
    if (this.loaded) return; // Another read may already have installed and changed this generation.
    const staged = new Map<string, Set<string>>();
    if (raw?.trim()) {
      const decoded: unknown = JSON.parse(raw);
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new TypeError('Invalid notification state');
      for (const [key, value] of Object.entries(decoded)) {
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new TypeError('Invalid notification IDs');
        staged.set(key, new Set(value as string[]));
      }
    }
    this.check(generation, guard);
    for (const [key, value] of staged) this.byUser.set(key, value);
    this.loaded = true;
  }
  ids(session: Session | null): Set<string> {
    const key = this.key(session);
    return new Set(key == null ? [] : this.byUser.get(key) ?? []);
  }
  async add(session: Session | null, ids: Iterable<string>, guard?: NotificationStateGuard): Promise<void> {
    const generation = this.generation; this.check(generation, guard);
    const key = this.key(session); if (key == null) return;
    const requested = [...ids].map(id => id.trim()).filter(Boolean);
    await this.load(guard); this.check(generation, guard);
    return this.enqueue(async () => {
      this.check(generation, guard);
      const set = new Set(this.byUser.get(key) ?? []);
      let changed = false;
      for (const id of requested) if (!set.has(id)) { set.add(id); changed = true; }
      if (changed) await this.persist(generation, key, set, guard);
      this.check(generation, guard);
    });
  }
  async remove(session: Session | null, ids: Iterable<string>, ignoreEmpty = true): Promise<Set<string>> {
    const generation = this.generation;
    const key = this.key(session); if (key == null) return new Set();
    const normalized = [...ids].map(id => id.trim());
    const requested = new Set(ignoreEmpty ? normalized.filter(Boolean) : normalized);
    await this.load(); this.check(generation);
    return this.enqueue(async () => {
      this.check(generation);
      const set = new Set(this.byUser.get(key) ?? []);
      const removed = new Set([...set].filter(id => requested.has(id)));
      if (!removed.size) return removed;
      for (const id of removed) set.delete(id);
      await this.persist(generation, key, set); return removed;
    });
  }
  async retain(session: Session | null, ids: Iterable<string>): Promise<void> {
    const generation = this.generation;
    const key = this.key(session); if (key == null) return;
    const allowed = new Set([...ids].map(id => id.trim()).filter(Boolean));
    await this.load(); this.check(generation);
    return this.enqueue(async () => {
      this.check(generation);
      const set = this.byUser.get(key); if (!set?.size) return;
      const kept = new Set([...set].filter(id => allowed.has(id)));
      if (kept.size !== set.size) await this.persist(generation, key, kept);
    });
  }
  async clearAll(): Promise<void> {
    const generation = ++this.generation;
    this.byUser.clear(); this.loaded = true;
    // A dispatched storage write cannot be cancelled. Remove after it settles so
    // it cannot restore the previous account's data after this reset completes.
    await this.enqueue(async () => {
      await this.storage.removeItem(this.prefKey);
      if (generation === this.generation) this.notify();
    });
  }
  private async persist(generation: number, key: string, values: Set<string>, guard?: NotificationStateGuard): Promise<void> {
    const staged = new Map(this.byUser);
    if (values.size) staged.set(key, values); else staged.delete(key);
    const result: Record<string, string[]> = {};
    for (const [user, ids] of staged) result[user] = [...ids].sort();
    const payload = JSON.stringify(result);
    this.check(generation, guard);
    this.byUser.clear();
    for (const [user, ids] of staged) this.byUser.set(user, ids);
    await this.storage.setItem(this.prefKey, payload);
    this.check(generation, guard); this.notify();
  }
}

/** @v2 NotificationHiddenStore */
export class NotificationHiddenStore {
  private readonly values: StoredIdSets;
  constructor(storage: AccountStorage, current: CurrentSession) { this.values = new StoredIdSets(storage, 'notification_hidden_v1', current); }
  load(): Promise<void> { return this.values.load(); }
  /** Captured account guards run before and after storage reads, before publication and write dispatch. */
  loadGuarded(guard: NotificationStateGuard): Promise<void> { return this.values.load(guard); }
  hideAllGuarded(session: Session, ids: Iterable<string>, guard: NotificationStateGuard): Promise<void> {
    return this.values.add(session, ids, guard);
  }
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
