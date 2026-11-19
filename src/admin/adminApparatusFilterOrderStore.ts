import type { AccountStorage } from '../savedAccountStore';
import { dartTrim } from './dartJsonString';

type Apparatus = { id: string; name: string };
type FilterOrderSnapshot = Readonly<{ savedIds: readonly string[]; ready: boolean; editing: boolean }>;

export function apparatusFilterOrderKey(profileRef: string) {
  const ref = dartTrim(profileRef);
  if (!ref) throw new Error('Profile reference is required');
  return `admin.production_map.apparatus_filter_order.v1.${ref}`;
}

function normalizedIds(ids: Iterable<string>) {
  return [...new Set([...ids].map(dartTrim).filter(Boolean))];
}

/** @v2 AdminApparatusFilterOrderStore */
export function applyApparatusFilterOrder<T extends Apparatus>(catalog: readonly T[], savedIds: readonly string[]): T[] {
  const remaining = new Map<string, T>();
  for (const item of catalog) {
    const id = dartTrim(item.id);
    if (id && dartTrim(item.name)) remaining.set(id, item);
  }
  const ordered: T[] = [];
  for (const value of savedIds) {
    const id = dartTrim(value), item = remaining.get(id);
    if (item) {
      ordered.push(item);
      remaining.delete(id);
    }
  }
  return [...ordered, ...remaining.values()];
}

export function reorderApparatusFilter<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const reordered = [...items];
  reordered.splice(to, 0, reordered.splice(from, 1)[0]);
  return reordered;
}

/** Owns display order only. The selected machine and its queue belong to the Work Map workspace. */
export class AdminApparatusFilterOrder {
  private state: FilterOrderSnapshot = { savedIds: [], ready: false, editing: false };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private active = false;
  private ticket: symbol | null = null;
  private writing: symbol | null = null;

  constructor(private readonly profileRef: string, private readonly preferences: AccountStorage, private readonly isCurrent: () => boolean) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private current(generation = this.generation) {
    return this.active && this.generation === generation && this.isCurrent() === true;
  }

  private publish(update: Partial<FilterOrderSnapshot>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach(listener => listener());
  }

  async start() {
    this.active = true;
    const generation = ++this.generation;
    this.ticket = null;
    this.publish({ savedIds: [], ready: false, editing: false });
    if (!dartTrim(this.profileRef) || !this.current(generation)) return;
    let ids: string[] = [];
    try {
      const stored = await this.preferences.getItem(apparatusFilterOrderKey(this.profileRef));
      const parsed: unknown = stored == null ? [] : JSON.parse(stored);
      if (Array.isArray(parsed)) ids = normalizedIds(parsed.filter((id): id is string => typeof id === 'string'));
    } catch { /* The filter keeps its server order if preferences are unavailable. */ }
    if (this.current(generation)) this.publish({ savedIds: ids, ready: true });
  }

  stop() {
    this.active = false;
    this.generation++;
    this.ticket = null;
  }

  begin(): symbol | null {
    if (!this.current() || !this.state.ready || this.state.editing) return null;
    const ticket = Symbol();
    this.ticket = ticket;
    this.publish({ editing: true });
    return ticket;
  }

  owns(ticket: symbol) {
    return this.current() && this.ticket === ticket;
  }

  cancel(ticket: symbol) {
    if (this.ticket !== ticket) return;
    this.ticket = null;
    if (this.current()) this.publish({ editing: false });
  }

  async save(ticket: symbol, draft: readonly string[] | null, catalog: readonly Apparatus[]) {
    if (!this.owns(ticket) || this.writing === ticket) return;
    this.writing = ticket;
    const key = apparatusFilterOrderKey(this.profileRef);
    const ids = draft === null ? [] : applyApparatusFilterOrder(catalog, draft).map(item => dartTrim(item.id));
    try {
      if (ids.length) await this.preferences.setItem(key, JSON.stringify(ids));
      else await this.preferences.removeItem(key);
      if (this.owns(ticket)) this.publish({ savedIds: ids });
    } catch (error) {
      if (this.owns(ticket)) throw error;
    } finally {
      if (this.writing === ticket) this.writing = null;
      this.cancel(ticket);
    }
  }
}
