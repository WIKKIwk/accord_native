import { trimDart } from './qolipApiCommon';
import type { QolipReworkEntry } from './qolipReworkApi';

type Prepared = { kind: 'confirm'; ids: string[]; scope: string };
type ReturnResult = { kind: 'returned'; count: number } | { kind: 'session_changed' } | { kind: 'failed'; error: unknown } | null;
type State = { entries: QolipReworkEntry[]; returned: boolean; selected: ReadonlySet<string>; query: string;
  loading: boolean; error: unknown | null; saving: boolean };
type Dependencies = {
  load: () => Promise<QolipReworkEntry[]>;
  returnFromRework: (requestId: string, ids: string[]) => Promise<QolipReworkEntry[]>;
  nextRequestId: () => Promise<string>;
  scope: () => string;
  notifyLocationsChanged: () => void;
};

/** Reworks read, selection and return state. Platform views and the request-ID source remain open. */
export class QolipReworksState {
  private value: State = { entries: [], returned: false, selected: new Set(), query: '', loading: true, error: null, saving: false };
  private active = true;
  private generation = 0;
  private readFuture = 0;
  private lifecycle = 0;
  private readScope: string;
  private requestSignature: string | null = null;
  private requestId: string | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies) { this.readScope = deps.scope(); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private update(patch: Partial<State>) {
    if (!this.active) return;
    this.value = { ...this.value, ...patch }; this.listeners.forEach(listener => listener());
  }
  activate() { if (!this.active) { this.active = true; this.update({ saving: false }); } }
  async load(): Promise<void> {
    if (!this.active) return;
    const scope = this.deps.scope(), generation = ++this.generation, future = ++this.readFuture;
    this.update({ loading: true, error: null });
    try {
      const entries = await this.deps.load();
      if (!this.active || generation !== this.generation || scope !== this.deps.scope()) return;
      this.readScope = scope;
      const openIds = new Set(entries.filter(entry => entry.is_open).map(entry => entry.id));
      this.update({ entries, selected: new Set([...this.value.selected].filter(id => openIds.has(id))) });
    } catch (error) {
      if (this.active && future === this.readFuture) this.update({ error });
      throw error;
    } finally { if (this.active && future === this.readFuture) this.update({ loading: false }); }
  }
  setQuery(query: string) { this.update({ query }); }
  setReturned(returned: boolean) { if (!this.value.saving) this.update({ returned, selected: new Set() }); }
  toggle(id: string) {
    if (this.value.saving) return;
    const selected = new Set(this.value.selected);
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    this.update({ selected });
  }
  selectGroup(entries: readonly QolipReworkEntry[], selected: boolean) {
    if (this.value.saving) return;
    const ids = new Set(this.value.selected);
    for (const entry of entries) { if (selected) ids.add(entry.id); else ids.delete(entry.id); }
    this.update({ selected: ids });
  }
  get groups(): { key: string; names: string[]; entries: QolipReworkEntry[]; selected: boolean }[] {
    const needle = trimDart(this.value.query).toLowerCase(), groups = new Map<string, QolipReworkEntry[]>();
    for (const entry of this.value.entries) {
      if (entry.is_open === this.value.returned || ![entry.qolip_code, entry.qolip_set_id, entry.item_code, entry.item_name]
        .some(value => value.toLowerCase().includes(needle))) continue;
      const key = entry.qolip_set_id || entry.qolip_code, group = groups.get(key) ?? [];
      group.push(entry); groups.set(key, group);
    }
    return [...groups].map(([key, entries]) => ({ key, entries,
      names: [...new Set(entries.map(entry => entry.item_name || entry.item_code).filter(Boolean))],
      selected: entries.every(entry => this.value.selected.has(entry.id)) }));
  }
  prepareReturn(): Prepared | { kind: 'session_changed' } | null {
    if (!this.active || this.value.saving || !this.value.selected.size) return null;
    const scope = this.deps.scope();
    return this.readScope !== scope ? { kind: 'session_changed' } : { kind: 'confirm', ids: [...this.value.selected].sort(), scope };
  }
  async confirmReturn(prepared: Prepared): Promise<ReturnResult> {
    if (!this.active || this.value.saving) return null;
    if (prepared.scope !== this.deps.scope()) return { kind: 'session_changed' };
    const signature = prepared.ids.join('\u0000'), lifecycle = this.lifecycle;
    this.update({ saving: true });
    try {
      if (this.requestSignature !== signature || this.requestId === null) {
        const requestId = await this.deps.nextRequestId();
        if (!this.active || lifecycle !== this.lifecycle) return null;
        if (prepared.scope !== this.deps.scope()) return { kind: 'session_changed' };
        this.requestId = requestId; this.requestSignature = signature;
      }
      const entries = await this.deps.returnFromRework(this.requestId, prepared.ids);
      if (!this.active || lifecycle !== this.lifecycle) return null;
      if (prepared.scope !== this.deps.scope()) return { kind: 'session_changed' };
      const updates = new Map(entries.map(entry => [entry.id, entry]));
      this.generation++;
      this.requestSignature = null; this.requestId = null;
      this.update({ entries: this.value.entries.map(entry => updates.get(entry.id) ?? entry), selected: new Set() });
      this.deps.notifyLocationsChanged();
      return { kind: 'returned', count: prepared.ids.length };
    } catch (error) {
      return this.active && lifecycle === this.lifecycle ? { kind: 'failed', error } : null;
    } finally { if (lifecycle === this.lifecycle) this.update({ saving: false }); }
  }
  dispose() { this.active = false; this.generation++; this.readFuture++; this.lifecycle++; this.listeners.clear(); }
}
