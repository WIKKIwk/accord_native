import type { SupplierItem } from '../shared/catalogApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminSupplierDetail } from './adminSupplierDetailModel';

export type AdminSupplierItemsPrompt = Readonly<{ serial: number; item: SupplierItem }>;
export type AdminSupplierItemsState = { valid: boolean; loading: boolean; mutating: boolean; supplierName: string; items: readonly SupplierItem[]; prompt: AdminSupplierItemsPrompt | null };
export type AdminSupplierItemsDependencies = {
  mode: 'add' | 'view'; isCurrent: () => boolean;
  detail: (guard: () => void, witness: () => boolean) => Promise<AdminSupplierDetail>;
  assigned: (guard: () => void, witness: () => boolean) => Promise<readonly SupplierItem[]>;
  all: (guard: () => void, witness: () => boolean) => Promise<readonly SupplierItem[]>;
  mutate: (item: SupplierItem, guard: () => void) => Promise<AdminSupplierDetail>;
};
const initial = (): AdminSupplierItemsState => ({ valid: true, loading: true, mutating: false, supplierName: '', items: [], prompt: null });
/** @v2 _AdminSupplierItemsViewScreenState and _AdminSupplierItemsAddScreenState */
export class AdminSupplierItemsController {
  private state = initial(); private active = false; private retired = false; private checking = false; private generation = 0; private serial = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: AdminSupplierItemsDependencies) {}
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  get mode() { return this.deps.mode; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminSupplierItemsState>) { if (!this.active) return; this.state = { ...this.state, ...patch }; for (const listener of [...this.listeners]) listener(); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; } return this.active && !this.retired && generation === this.generation;
  };
  private guard(generation: number): () => void { return () => { if (!this.isCurrent(generation)) throw new Error('Admin supplier items owner changed'); }; }
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.load(); }
  private async load(): Promise<void> {
    const generation = this.generation, check = this.guard(generation), witness = () => { check(); return true; }; this.publish({ loading: true });
    try {
      check(); const detail = await this.deps.detail(check, witness); check();
      const rows = this.deps.mode === 'view' ? await this.deps.assigned(check, witness) : await this.deps.all(check, witness); check();
      const assigned = new Set(detail.assigned_items.map(item => item.code));
      this.publish({ supplierName: detail.name, items: this.deps.mode === 'view' ? rows : rows.filter(item => !assigned.has(item.code)) });
    } catch { /* V2 adds no error/retry/notice; its finally shows the retained table, initially empty. */ }
    finally { if (this.isCurrent(generation)) this.publish({ loading: false }); }
  }
  request(item: SupplierItem): void {
    if (this.isCurrent() && !this.state.loading && !this.state.mutating && !this.state.prompt && this.state.items.includes(item)) this.publish({ prompt: Object.freeze({ serial: ++this.serial, item }) });
  }
  dismiss(prompt: AdminSupplierItemsPrompt): void { if (this.isCurrent() && this.state.prompt === prompt) this.publish({ prompt: null }); }
  async confirm(prompt: AdminSupplierItemsPrompt): Promise<void> {
    if (!this.isCurrent() || this.state.prompt !== prompt || this.state.mutating) return;
    const generation = this.generation, check = this.guard(generation); this.publish({ prompt: null, mutating: true });
    try {
      check(); await this.deps.mutate(prompt.item, check); check();
      this.publish({ items: this.state.items.filter(item => item.code !== prompt.item.code) });
    } finally { if (this.isCurrent(generation)) this.publish({ mutating: false }); }
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.generation++; this.publish({ ...initial(), valid: false, loading: false }); }
  dispose(): void { this.active = false; this.generation++; this.state = { ...initial(), valid: !this.retired }; this.listeners.clear(); }
}
