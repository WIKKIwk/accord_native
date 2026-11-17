import type { QolipBlock, QolipBlocksResult } from './qolipBlocksApi';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { qolipMoveReachedTarget, qolipMoveTargetBlocks } from './qolipLocationLogic';
import { normalizeQolipCellLabel } from './qolipCellPickerLogic';
import { trimDart } from './qolipApiCommon';
type Dependencies = { current(): boolean; blocks(): Promise<QolipBlocksResult>; locations(block: string): Promise<QolipLocationEntry[]>;
  move(input: { locationId: string; targetBlock: QolipBlock; quantity: number; rowLetter: string; columnNumber: number }): Promise<QolipLocationEntry>;
  message(key: string, values?: Record<string, unknown>): void; failure(error: unknown): void };
const same = (a: string, b: string) => trimDart(a).toLowerCase() === trimDart(b).toLowerCase();
/** @v2 QolipLocationTransferScreen */
export class QolipLocationTransferState {
  private generation = 0; private locationGeneration = 0;
  private listeners = new Set<() => void>();
  private value = { data: null as QolipBlocksResult | null, loading: true, error: false, locationsLoading: false, locationsError: false,
    locations: [] as QolipLocationEntry[], sourceBlock: '', targetBlock: '', source: null as QolipLocationEntry | null, cell: null as string | null, quantity: '', saving: false };
  constructor(private readonly deps: Dependencies) {}
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  getSnapshot = () => this.value;
  private update(patch: Partial<typeof this.value>) { if (!this.deps.current()) return; this.value = { ...this.value, ...patch }; this.listeners.forEach(callback => callback()); }
  block(name: string) { return this.value.data?.blocks.find(block => same(block.name, name)) ?? null; }
  get targetBlocks() { const v = this.value; return v.data && v.source ? qolipMoveTargetBlocks({ blocks: v.data.blocks, source: v.source, supportsCrossBlockMove: v.data.supports_cross_block_move }) : []; }
  async reload() {
    if (!this.deps.current()) return;
    const generation = ++this.generation; this.locationGeneration++;
    this.update({ loading: true, error: false, sourceBlock: '', targetBlock: '', source: null, cell: null, quantity: '', locations: [] });
    try {
      const data = await this.deps.blocks(); if (!this.deps.current() || generation !== this.generation) return;
      this.update({ data, loading: false }); if (data.blocks.length) await this.selectSourceBlock(data.blocks[0].name);
    } catch { if (generation === this.generation) this.update({ loading: false, error: true }); }
  }
  async loadLocations() {
    const name = this.value.sourceBlock; if (!name || !this.deps.current()) return;
    const generation = ++this.locationGeneration; this.update({ locationsLoading: true, locationsError: false });
    try { const locations = await this.deps.locations(name); if (generation === this.locationGeneration) this.update({ locations, locationsLoading: false }); }
    catch { if (generation === this.locationGeneration) this.update({ locationsLoading: false, locationsError: true }); }
  }
  async selectSourceBlock(name: string) {
    if (this.value.saving || !trimDart(name) || !this.deps.current()) return;
    this.update({ sourceBlock: name, targetBlock: name, source: null, cell: null, quantity: '' }); await this.loadLocations();
  }
  selectSource(id: string) { if (this.value.saving) return; const source = this.value.locations.find(row => row.id === id) ?? null;
    this.update({ source, targetBlock: source?.block ?? this.value.targetBlock, cell: null, quantity: source ? String(source.quantity) : '' }); }
  selectTargetBlock(name: string) { if (!this.value.saving) this.update({ targetBlock: name, cell: null }); }
  setQuantity(quantity: string) { if (!this.value.saving) this.update({ quantity }); }
  setCell(raw: string) { const cell = normalizeQolipCellLabel(raw); if (cell && !this.value.saving) this.update({ cell }); }
  async transfer() {
    if (this.value.saving || !this.deps.current()) return;
    const v = this.value, source = v.source, targetBlock = this.block(v.targetBlock);
    if (!source || !targetBlock) { this.deps.message('transfer.source_required'); return; }
    if (!v.cell) { this.deps.message('transfer.cell_required'); return; }
    const rawQuantity = trimDart(v.quantity), quantity = /^[+-]?\d+$/.test(rawQuantity) ? Number(rawQuantity) : 0;
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > source.quantity) { this.deps.message('transfer.quantity_range', { max: source.quantity }); return; }
    const rowLetter = v.cell[0], columnNumber = Number(v.cell.slice(1));
    if (!Number.isInteger(columnNumber)) { this.deps.message('transfer.invalid_cell'); return; }
    this.update({ saving: true });
    try {
      const moved = await this.deps.move({ locationId: source.id, targetBlock, quantity, rowLetter, columnNumber });
      if (!this.deps.current()) return;
      if (!qolipMoveReachedTarget({ moved, targetBlock, qolipCode: source.qolip_code, rowLetter, columnNumber })) {
        this.deps.message('transfer.target_unconfirmed', { location: moved.block + ' / ' + moved.location_label }); return;
      }
      this.deps.message('transfer.moved', { item: source.item_name, block: targetBlock.name, cell: v.cell });
      this.update({ source: null, cell: null, quantity: '' }); await this.loadLocations();
    } catch (error) { if (this.deps.current()) this.deps.failure(error); }
    finally { this.update({ saving: false }); }
  }
}
