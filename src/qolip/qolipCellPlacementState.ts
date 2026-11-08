import type { QolipBlock } from './qolipBlocksApi';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { QolipCellProductPicker, qolipPlacedCodes, type QolipPlacementProduct } from './qolipCellPlacement';

type Target = { block: QolipBlock; rowLetter: string; columnNumber: number };
type Prepared = { target: Target; products: readonly QolipPlacementProduct[]; scope: string };
type PlacementResult = { kind: 'saved'; target: Target; products: readonly QolipPlacementProduct[] }
  | { kind: 'partial'; saved: number; failed: number }
  | { kind: 'failed'; error: unknown }
  | { kind: 'session_changed'; saved: number }
  | null;
type Dependencies = {
  locations: (block: string) => Promise<readonly QolipLocationEntry[]>;
  products: () => Promise<QolipPlacementProduct[]>;
  save: (target: Target, product: QolipPlacementProduct) => Promise<unknown>;
  scope: () => string;
  valid: () => boolean;
};
type State = { block: QolipBlock | null; rowLetter: string | null; columnNumber: number | null;
  selected: readonly QolipPlacementProduct[]; saving: boolean };

/** Cell placement state only; no view or navigation is implied. */
export class QolipCellPlacementState {
  private value: State;
  private readonly openedScope: string;
  private active = true;
  private invalidated = false;
  private inFlight = false;
  private readonly idleCallbacks = new Set<() => void>();
  private lifecycle = 0;
  private placed: Promise<Set<string>> | null = null;
  private products: Promise<QolipPlacementProduct[]> | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies, private readonly blocks: readonly QolipBlock[], input: {
    initialBlock?: QolipBlock | null; rowLetter?: string | null; columnNumber?: number | null;
    product?: QolipPlacementProduct | null;
  } = {}) {
    this.openedScope = deps.scope();
    const initial = input.initialBlock;
    const block = initial && blocks.find(item => item.name === initial.name && item.warehouse === initial.warehouse);
    this.value = { block: block || blocks[0] || null, rowLetter: input.rowLetter ?? null,
      columnNumber: input.columnNumber ?? null, selected: input.product ? [input.product] : [], saving: false };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private update(patch: Partial<State>) {
    if (!this.active) return;
    this.value = { ...this.value, ...patch }; this.listeners.forEach(listener => listener());
  }
  activate() { if (!this.active && !this.invalidated) { this.active = true; this.update({ saving: this.inFlight }); } }
  private isCurrent() { return this.active && !this.invalidated && this.deps.valid() && this.deps.scope() === this.openedScope; }
  /** @v2 _loadPlacedQolipCodes */
  start() {
    if (!this.isCurrent()) return;
    this.placed ??= qolipPlacedCodes(this.blocks, this.deps.locations);
    // A picker may never be opened. Attach a rejection handler without changing the cached failure.
    void this.placed.catch(() => {});
  }
  openPicker(): QolipCellProductPicker | null {
    if (!this.isCurrent() || this.inFlight) return null;
    this.start();
    return new QolipCellProductPicker(() => this.products ??= this.deps.products(), this.placed!,
      () => this.isCurrent());
  }
  selectProduct(product: QolipPlacementProduct | null) {
    if (!this.isCurrent() || this.inFlight) return;
    this.update({ selected: product ? [product] : [] });
  }
  get canSave(): boolean {
    const { block, rowLetter, columnNumber, selected, saving } = this.value;
    return this.isCurrent() && !saving && !!block && rowLetter !== null && columnNumber !== null &&
      selected.length > 0 && selected.every(product => product.has_qolip_spec);
  }
  private target(): Target | null {
    const { block, rowLetter, columnNumber } = this.value;
    return block && rowLetter !== null && columnNumber !== null ? { block, rowLetter, columnNumber } : null;
  }
  /** Caller displays this confirmation and calls confirmMulti only after acceptance. */
  prepareMulti(products: readonly QolipPlacementProduct[]): Prepared | null {
    const target = this.target();
    return this.isCurrent() && !this.inFlight && target
      ? { target, products: [...products], scope: this.openedScope } : null;
  }
  async confirmMulti(prepared: Prepared): Promise<PlacementResult> {
    if (!this.isCurrent() || prepared.scope !== this.deps.scope()) return { kind: 'session_changed', saved: 0 };
    return this.save(prepared.products);
  }
  async saveSelected(): Promise<PlacementResult> {
    if (!this.canSave) return null;
    return this.save(this.value.selected);
  }
  /** @v2 _saveCellProducts */
  private async save(products: readonly QolipPlacementProduct[]): Promise<PlacementResult> {
    const target = this.target(), valid = products.filter(product => product.has_qolip_spec);
    if (!this.active || this.inFlight || !target || !valid.length) return null;
    if (!this.isCurrent()) return { kind: 'session_changed', saved: 0 };
    const lifecycle = this.lifecycle;
    this.inFlight = true; this.update({ saving: true });
    let saved = 0, firstError: unknown;
    try {
      for (const product of valid) {
        if (this.invalidated || !this.deps.valid() || this.deps.scope() !== this.openedScope) return { kind: 'session_changed', saved };
        try { await this.deps.save(target, product); saved++; } catch (error) { firstError ??= error; }
      }
      if (!this.active || lifecycle !== this.lifecycle) return null;
      if (this.invalidated || !this.deps.valid() || this.deps.scope() !== this.openedScope) return { kind: 'session_changed', saved };
      if (saved === valid.length) return { kind: 'saved', target, products: valid };
      return saved ? { kind: 'partial', saved, failed: valid.length - saved }
        : { kind: 'failed', error: firstError ?? new Error('mold_placement_failed') };
    } finally {
      this.inFlight = false;
      if (lifecycle === this.lifecycle) this.update({ saving: false });
      for (const callback of this.idleCallbacks) callback();
      this.idleCallbacks.clear();
    }
  }
  onIdle(callback: () => void) {
    if (this.inFlight) this.idleCallbacks.add(callback); else callback();
  }
  invalidateSession() { this.invalidated = true; this.dispose(); }
  dispose() { this.active = false; this.lifecycle++; this.listeners.clear(); }
}
