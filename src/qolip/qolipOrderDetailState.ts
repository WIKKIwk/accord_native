import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { qolipMergedStageBatches, qolipOpeningStageBatches, qolipOrderStageFacts, type QolipOrderStageFacts, type QolipStageBatch } from './qolipOrderStageFacts';
import { qolipSequenceMolds, type QolipSequenceMold } from './qolipSequenceMolds';
import type { QolipSequenceOrder } from './useQolipSequenceMolds';
import type { openingWipRecordFromJson } from '../workerOpeningWipRecordsApi';
type Snapshot = {
  invalid: boolean; order: QolipSequenceOrder | null; pending: boolean; error: unknown;
  materials: AdminRawMaterialAssignment[]; materialsLoading: boolean; materialsError: unknown; materialsExpanded: boolean;
  molds: QolipSequenceMold[]; moldsLoading: boolean; moldsError: unknown; moldsExpanded: boolean;
  mapExpanded: boolean; stageLoading: boolean; stageLoaded: boolean; stageError: boolean; stageFacts: ReadonlyMap<string, QolipOrderStageFacts>;
};
type Deps = {
  order(current: () => boolean): Promise<QolipSequenceOrder>;
  materials(order: QolipSequenceOrder, current: () => boolean): Promise<AdminRawMaterialAssignment[]>;
  molds(order: QolipSequenceOrder, current: () => boolean): Promise<QolipSequenceMold[]>;
  stageBatches(order: QolipSequenceOrder, current: () => boolean): Promise<QolipStageBatch[]>;
  openingBatches(order: QolipSequenceOrder, current: () => boolean): Promise<ReturnType<typeof openingWipRecordFromJson>[]>;
  subscribeRevision(listener: () => void): () => void;
};
function timeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), milliseconds); })])
    .finally(() => clearTimeout(timer));
}
/** @v2 _ReadOnlyOrderDetailSheet (non-worker) / _OrderMapProgressCardState */
export class QolipOrderDetailState {
  private active = false;
  private generation = 0;
  private materialGeneration = 0;
  private moldGeneration = 0;
  private stageGeneration = 0;
  private stageReloadPending = false;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeRevision: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private value: Snapshot;
  constructor(private boundary: QolipHomeReadBoundary, private orderId: string, private deps: Deps, initialOrder?: QolipSequenceOrder) {
    this.value = { invalid: false, order: initialOrder?.map.id === orderId ? initialOrder : null, pending: true, error: null,
      materials: [], materialsLoading: true, materialsError: null, materialsExpanded: false,
      molds: [], moldsLoading: true, moldsError: null, moldsExpanded: false,
      mapExpanded: false, stageLoading: false, stageLoaded: false, stageError: false, stageFacts: new Map() };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  current = (): boolean => {
    if (!this.active || this.value.invalid) return false;
    try { if (this.boundary.current() === true) return true; } catch { /* Retire the original presentation. */ }
    this.invalidate(); return false;
  };
  private publish(patch: Partial<Snapshot>) { if (!this.current()) return; this.value = { ...this.value, ...patch }; this.emit(); }
  private emit() { for (const listener of this.listeners) listener(); }
  activate() {
    if (this.value.invalid) return;
    this.active = true;
    this.unsubscribe = this.boundary.subscribe(() => { this.current(); });
    this.unsubscribeRevision = this.deps.subscribeRevision(() => { if (this.current() && this.value.mapExpanded) void this.loadStages(); });
  }
  suspend() {
    this.active = false; this.generation++; this.materialGeneration++; this.moldGeneration++; this.stageGeneration++;
    this.unsubscribe?.(); this.unsubscribe = null; this.unsubscribeRevision?.(); this.unsubscribeRevision = null;
  }
  private invalidate() {
    if (this.value.invalid) return;
    this.generation++; this.materialGeneration++; this.moldGeneration++; this.stageGeneration++;
    this.value = { ...this.value, invalid: true, order: null, materials: [], molds: [], stageFacts: new Map() }; this.emit();
  }
  async load() {
    if (!this.current()) return;
    const version = ++this.generation, current = () => this.current() && version === this.generation;
    this.publish({ pending: true, error: null });
    try {
      const order = await this.deps.order(current); if (!current()) return;
      if (order.map.id.trim() !== this.orderId.trim()) throw new TypeError('production_map_order_mismatch');
      this.publish({ order, pending: false });
      await Promise.all([this.loadMaterials(true), this.loadMolds()]);
    } catch (error) { if (current()) this.publish({ pending: false, error }); }
  }
  async loadMaterials(showLoading = true) {
    const order = this.value.order; if (!order || !this.current()) return;
    const version = ++this.materialGeneration, current = () => this.current() && version === this.materialGeneration;
    this.publish({ materialsLoading: showLoading || this.value.materialsLoading, materialsError: null });
    try { const materials = await timeout(this.deps.materials(order, current), 5000); if (current()) this.publish({ materials, materialsLoading: false }); }
    catch (materialsError) { if (current()) this.publish({ materials: [], materialsLoading: false, materialsError }); }
  }
  private async loadMolds() {
    const order = this.value.order; if (!order || !this.current()) return;
    const version = ++this.moldGeneration, current = () => this.current() && version === this.moldGeneration;
    this.publish({ moldsLoading: true, moldsError: null });
    try { const molds = order.map.product_code.trim() ? await this.deps.molds(order, current) : [];
      if (current()) this.publish({ molds: qolipSequenceMolds(molds), moldsLoading: false }); }
    catch (moldsError) { if (current()) this.publish({ molds: [], moldsLoading: false, moldsError }); }
  }
  toggleMaterials = () => {
    if (!this.current() || this.value.pending || this.value.materialsLoading || !(this.value.materials.length || this.value.materialsError)) return;
    this.publish({ materialsExpanded: !this.value.materialsExpanded });
    if (this.value.materialsExpanded) void this.loadMaterials(false);
  };
  toggleMolds = () => {
    if (!this.current() || this.value.pending || !(this.value.moldsLoading || this.value.molds.length || this.value.moldsError)) return;
    this.publish({ moldsExpanded: !this.value.moldsExpanded });
  };
  toggleMap = () => {
    if (!this.current() || this.value.pending || !this.value.order) return;
    this.stageGeneration++; this.stageReloadPending = false;
    this.publish({ mapExpanded: !this.value.mapExpanded, stageLoading: false });
    if (this.value.mapExpanded) void this.loadStages();
  };
  loadStages = async () => {
    const order = this.value.order; if (!order || !this.current() || !this.value.mapExpanded) return;
    if (this.value.stageLoading) { this.stageReloadPending = true; return; }
    this.stageReloadPending = false;
    const version = ++this.stageGeneration, current = () => this.current() && version === this.stageGeneration && this.value.mapExpanded;
    this.publish({ stageLoading: true, stageError: false });
    try {
      const training = order.map.id.startsWith('training-');
      const [progress, opening] = training ? [[], []] : await timeout(Promise.all([this.deps.stageBatches(order, current), this.deps.openingBatches(order, current)]), 12000);
      if (!current()) return;
      const batches = qolipMergedStageBatches(progress, qolipOpeningStageBatches(order, opening));
      const stageFacts = new Map(order.map.nodes.filter(node => node.kind === 'apparatus').map(node => [node.id, qolipOrderStageFacts(order.map, node, batches)]));
      this.publish({ stageFacts, stageLoading: false, stageLoaded: true });
    } catch { if (current()) this.publish({ stageLoading: false, stageError: true }); }
    finally { if (current() && this.stageReloadPending) { this.stageReloadPending = false; void this.loadStages(); } }
  };
}
