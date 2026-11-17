import type { AdminInactiveSupplier } from './adminInactiveSuppliersApi';

export type AdminInactiveSuppliersState = Readonly<{
  phase: 'loading' | 'content' | 'error' | 'invalidated'; items: readonly AdminInactiveSupplier[]; busyRef: string | null;
}>;
export type AdminInactiveSuppliersDependencies = Readonly<{
  isCurrent: () => boolean;
  read: (guard: () => void, witness: () => boolean) => Promise<readonly AdminInactiveSupplier[]>;
  restore: (ref: string, guard: () => void) => Promise<unknown>;
  unblock: (ref: string, guard: () => void) => Promise<unknown>;
}>;

/** @v2 _AdminInactiveSuppliersScreenState */
export class AdminInactiveSuppliersController {
  private state: AdminInactiveSuppliersState = Object.freeze({ phase: 'loading', items: [], busyRef: null });
  private listeners = new Set<() => void>();
  private active = false;
  private generation = 0;
  private readGeneration = 0;
  constructor(private readonly deps: AdminInactiveSuppliersDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(patch: Partial<AdminInactiveSuppliersState>) {
    this.state = Object.freeze({ ...this.state, ...patch }); this.listeners.forEach(listener => listener());
  }
  isCurrent = () => this.active && this.deps.isCurrent();
  start() { if (!this.active) { this.active = true; this.generation++; void this.reload().catch(() => {}); } }
  stop() { this.active = false; this.generation++; this.readGeneration++; }
  invalidate() { this.stop(); this.publish({ phase: 'invalidated', items: [], busyRef: null }); }
  async reload(): Promise<void> {
    if (!this.isCurrent()) return;
    const owner = this.generation, read = ++this.readGeneration;
    const current = () => this.isCurrent() && this.generation === owner;
    const guard = () => { if (!current()) throw new Error('Inactive supplier scope changed'); };
    // FutureBuilder replaces the visible body with loading for each new future.
    this.publish({ phase: 'loading' });
    try {
      guard(); const items = await this.deps.read(guard, current); guard();
      if (read === this.readGeneration) this.publish({ phase: 'content', items });
    } catch (error) {
      if (current() && read === this.readGeneration) this.publish({ phase: 'error' });
      throw error;
    }
  }
  restore = (item: AdminInactiveSupplier) => this.change(item, true);
  unblock = (item: AdminInactiveSupplier) => this.change(item, false);
  private async change(item: AdminInactiveSupplier, restore: boolean): Promise<void> {
    if (!this.isCurrent() || this.state.phase !== 'content' || !this.state.items.includes(item) ||
      this.state.busyRef === item.ref || (restore ? !item.removed : item.removed || !item.blocked)) return;
    const owner = this.generation;
    const current = () => this.isCurrent() && this.generation === owner;
    const guard = () => { if (!current()) throw new Error('Inactive supplier scope changed'); };
    this.publish({ busyRef: item.ref });
    try {
      guard(); await (restore ? this.deps.restore(item.ref, guard) : this.deps.unblock(item.ref, guard)); guard();
      await this.reload();
    } finally {
      // V2 has one busyRef, not a global write lock. Other rows remain usable.
      if (current()) this.publish({ busyRef: null });
    }
  }
}
