import type { Session } from '../auth';
import { qolipRenameSet, type QolipManagedSet } from './qolipSetsApi';

type State = { name: string; saving: boolean; error: unknown | null };
/** @v2 _QolipSetNameDialogState */
export class QolipSetNameState {
  private value: State;
  private active = true;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  constructor(entry: QolipManagedSet, private readonly rename: (name: string) => Promise<QolipManagedSet>) {
    this.value = { name: entry.name, saving: false, error: null };
  }
  static forSession(session: Session, entry: QolipManagedSet) {
    return new QolipSetNameState(entry, name => qolipRenameSet(session, entry.set.id, name));
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private update(patch: Partial<State>) {
    if (!this.active) return;
    this.value = { ...this.value, ...patch };
    this.listeners.forEach(listener => listener());
  }
  activate() { if (!this.active) { this.active = true; this.update({ saving: false }); } }
  setName(name: string) { if (!this.value.saving) this.update({ name, error: null }); }
  async save(): Promise<QolipManagedSet | null> {
    if (!this.active || this.value.saving) return null;
    const generation = this.generation;
    this.update({ saving: true, error: null });
    try {
      const saved = await this.rename(this.value.name);
      return this.active && generation === this.generation ? saved : null;
    } catch (error) {
      if (this.active && generation === this.generation) this.update({ error });
      return null;
    } finally { if (generation === this.generation) this.update({ saving: false }); }
  }
  dispose() { this.active = false; this.generation++; this.listeners.clear(); }
}
