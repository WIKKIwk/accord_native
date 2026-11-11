import type { Session } from '../auth';
import type { InventoryViewLease, InventoryViewStore } from './inventoryViewStore';
import { movementAssetKey, movementAvailable, movementCanSelect, movementFilterTransfers, movementQrMatches, movementScanBarcode, movementWarehouses,
  type MovementAsset, type MovementLocation, type MovementTab, type MovementTransfer } from './inventoryMovementModel';

export type MovementState = {
  tab: MovementTab; warehouse: string; query: string; locations: readonly MovementLocation[]; assets: readonly MovementAsset[];
  incoming: readonly MovementTransfer[]; outgoing: readonly MovementTransfer[]; selected: ReadonlySet<string>; qrAssets: readonly MovementAsset[];
  scanning: boolean; qrStatus: string; loading: boolean; assetsLoading: boolean; transferLoading: boolean; error: string; notice: string; busy: ReadonlySet<string>;
};
export type MovementDependencies = {
  store: InventoryViewStore; current(): boolean; restore(): Promise<string | null>; save(warehouse: string): Promise<void>;
  lookup(barcode: string): Promise<MovementAsset[]>;
  relocate(asset: MovementAsset, location: MovementLocation, key: string): Promise<MovementAsset>;
  relocateBatch(assets: readonly MovementAsset[], location: MovementLocation, key: string): Promise<MovementAsset[]>;
  transfer(asset: MovementAsset, location: MovementLocation, key: string): Promise<MovementTransfer>;
  key(action: string): string;
};
const message = (error: unknown) => error instanceof Error && 'code' in error ? error.message : 'Amal bajarilmadi. Qayta urinib ko‘ring.';

/** @v2 _InventoryMovementsScreenState */
export class InventoryMovementController {
  private disposed = false;
  private started = false;
  private mounts = 0;
  private locationsView: InventoryViewLease | null = null;
  private assetView: InventoryViewLease | null = null;
  private assetQuery = '';
  private transferViews = new Map<'incoming' | 'outgoing', InventoryViewLease>();
  private listeners = new Set<() => void>();
  private transfers = { incoming: [] as readonly MovementTransfer[], outgoing: [] as readonly MovementTransfer[] };
  private cleanups = new Map<InventoryViewLease, () => void>();
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private lookupBusy = new Set<string>();
  private operations = new Set<string>();
  private state: MovementState = { tab: 'assets', warehouse: '', query: '', locations: [], assets: [], incoming: [], outgoing: [], selected: new Set(), qrAssets: [],
    scanning: false, qrStatus: 'QR kodni ramkaga keltiring', loading: true, assetsLoading: false, transferLoading: false, error: '', notice: '', busy: new Set() };
  constructor(readonly session: Session, readonly dependencies: MovementDependencies) {}
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  readonly current = () => !this.disposed && this.dependencies.current();
  mount() { this.mounts++; void this.start(); }
  unmount() { this.mounts--; queueMicrotask(() => { if (!this.mounts) this.dispose(); }); }
  private update(patch: Partial<MovementState>) {
    if (!this.current()) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private watch(view: InventoryViewLease, listener: () => void) { view.addListener(listener); this.cleanups.set(view, listener); }
  private release(view: InventoryViewLease | null) {
    if (!view) return;
    const listener = this.cleanups.get(view); if (listener) view.removeListener(listener);
    this.cleanups.delete(view); view.dispose();
  }
  async start() {
    if (this.started || !this.current()) return;
    this.started = true;
    try { const saved = await this.dependencies.restore(); if (this.current()) this.update({ warehouse: saved?.trim() ?? '' }); } catch { /* Source permits preference failure. */ }
    if (!this.current()) return;
    this.locationsView = this.dependencies.store.locations();
    this.watch(this.locationsView, () => this.acceptLocations());
    this.acceptLocations();
    try { await this.locationsView.ready; } catch (error) { this.update({ loading: false, error: message(error) }); }
    if (this.current()) this.acceptLocations();
  }
  private acceptLocations() {
    if (!this.current()) return;
    const rows = this.locationsView?.rows as readonly MovementLocation[] | null;
    if (!rows) {
      this.update({ loading: this.locationsView?.loading ?? false, error: this.locationsView?.error ?? '', locations: [], assets: [], incoming: [], outgoing: [], selected: new Set(), qrAssets: [] });
      return;
    }
    const visible = movementWarehouses(this.session, rows);
    const warehouse = visible.some(row => row.warehouse_id === this.state.warehouse) ? this.state.warehouse : visible[0]?.warehouse_id ?? '';
    const changed = warehouse !== this.state.warehouse;
    this.update({ locations: rows, warehouse, loading: false, error: '' }); this.filterTransfers();
    if (changed || !this.assetView) this.loadAssets();
  }
  get warehouses() { return movementWarehouses(this.session, this.state.locations); }
  get states() { return this.state.locations.filter(row => row.kind === 'state' && row.active); }
  selectWarehouse(warehouse: string) {
    if (!this.current() || !this.warehouses.some(row => row.warehouse_id === warehouse)) return;
    this.update({ warehouse, selected: new Set() }); this.filterTransfers(); this.loadAssets();
    void this.dependencies.save(warehouse).catch(() => {});
  }
  search(query: string) {
    this.update({ query }); this.filterTransfers(); clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadAssets(), 350);
  }
  private loadAssets() {
    if (!this.current()) return;
    const { warehouse, query } = this.state;
    if (!warehouse) { this.release(this.assetView); this.assetView = null; this.assetQuery = ''; this.update({ assets: [], assetsLoading: false }); return; }
    const key = JSON.stringify([warehouse, query.trim(), false]);
    if (this.assetView && this.assetQuery === key) return;
    this.release(this.assetView); this.assetQuery = key;
    this.assetView = this.dependencies.store.assets({ warehouseId: warehouse, query: query.trim(), includeOrderAssignment: false });
    const view = this.assetView;
    const changed = () => {
      if (!this.current() || view !== this.assetView) return;
      const assets = (view.rows ?? []) as readonly MovementAsset[];
      const keys = new Set(assets.map(movementAssetKey));
      this.update({ assets, assetsLoading: !view.rows && view.loading, selected: new Set([...this.state.selected].filter(value => keys.has(value))) });
      if (view.error && !view.rows) this.update({ notice: view.error });
    };
    this.watch(view, changed); changed(); void view.ready.catch(error => { if (view === this.assetView) this.update({ notice: message(error), assetsLoading: false }); });
  }
  setTab(tab: MovementTab) {
    this.update({ tab }); if (!this.current() || tab === 'assets') return;
    if (!this.transferViews.has(tab)) {
      const view = this.dependencies.store.transfers({ direction: tab }); this.transferViews.set(tab, view);
      this.watch(view, () => this.acceptTransfers(tab)); void view.ready.catch(() => this.acceptTransfers(tab));
    }
    this.acceptTransfers(tab);
  }
  private acceptTransfers(direction: 'incoming' | 'outgoing') {
    if (!this.current()) return;
    const view = this.transferViews.get(direction); if (!view) return;
    this.transfers[direction] = (view.rows ?? []) as readonly MovementTransfer[];
    if (this.state.tab === direction) this.update({ transferLoading: !view.rows && view.loading, error: view.rows ? '' : view.error ?? '' });
    this.filterTransfers();
  }
  private filterTransfers() {
    const warehouse = this.warehouses.find(row => row.warehouse_id === this.state.warehouse)?.name ?? '';
    this.update({ incoming: movementFilterTransfers(this.transfers.incoming, warehouse, 'incoming', this.state.query),
      outgoing: movementFilterTransfers(this.transfers.outgoing, warehouse, 'outgoing', this.state.query) });
  }
  async refresh() {
    if (!this.current()) return;
    try {
      if (this.state.tab === 'assets') { await this.locationsView?.refresh(); await this.assetView?.refresh(); }
      else await this.transferViews.get(this.state.tab)?.refresh();
    } catch (error) { this.update({ notice: message(error) }); }
  }
  toggleScanning() {
    this.lookupBusy.clear(); this.update({ scanning: !this.state.scanning, qrAssets: [], selected: new Set(), qrStatus: 'QR kodni ramkaga keltiring' });
  }
  async lookup(raw: string) {
    const barcode = movementScanBarcode(raw), key = barcode.toLowerCase();
    if (!this.current() || !barcode || this.lookupBusy.has(key)) return;
    this.lookupBusy.add(key); this.update({ qrStatus: 'QR bazadan tekshirilmoqda...' });
    try {
      const matches = movementQrMatches(await this.dependencies.lookup(barcode), barcode);
      if (!this.current() || !this.locationsView?.rows) return;
      if (!matches.length) throw Object.assign(new Error('Bu QR bo‘yicha mahsulot topilmadi'), { code: 'inventory_qr_asset_not_found' });
      const next = [...this.state.qrAssets];
      for (const asset of matches) { const index = next.findIndex(row => movementAssetKey(row) === movementAssetKey(asset)); if (index < 0) next.unshift(asset); else next[index] = asset; }
      this.update({ qrAssets: next, qrStatus: `${matches.length} ta mahsulot topildi` });
    } catch (error) { this.update({ qrStatus: message(error), notice: message(error) }); }
    finally { this.lookupBusy.delete(key); }
  }
  toggleSelection(asset: MovementAsset) {
    if (!this.current() || !movementCanSelect(this.session, asset, this.state.warehouse) || [...this.operations].some(key => key.includes(`${asset.kind}:${asset.asset_ref}`))) return;
    const selected = new Set(this.state.selected), key = movementAssetKey(asset);
    if (!selected.delete(key)) selected.add(key); this.update({ selected });
  }
  clearSelection() { this.update({ selected: new Set() }); }
  get selectedAssets() {
    const selected = new Map<string, MovementAsset>();
    for (const asset of [...this.state.assets, ...this.state.qrAssets]) if (this.state.selected.has(movementAssetKey(asset))) selected.set(movementAssetKey(asset), asset);
    return [...selected.values()];
  }
  relocateDestinations(asset: MovementAsset) {
    return [...this.states, ...this.state.locations.filter(row => row.kind === 'warehouse' && row.active && row.warehouse_id === asset.custody_warehouse_id && row.id !== asset.physical_location.id)];
  }
  transferDestinations(asset: MovementAsset) { return this.state.locations.filter(row => row.kind === 'warehouse' && row.active && row.warehouse_id !== asset.custody_warehouse_id); }
  private async run(key: string, action: () => Promise<void>) {
    if (!this.current() || this.operations.has(key)) return;
    this.operations.add(key); this.update({ busy: new Set(this.operations) });
    try { await action(); } catch (error) { this.update({ notice: message(error) }); }
    finally { this.operations.delete(key); this.update({ busy: new Set(this.operations) }); }
  }
  async relocate(asset: MovementAsset, location: MovementLocation) {
    if (!movementAvailable(asset) || !this.relocateDestinations(asset).some(row => row.id === location.id)) return;
    await this.run(`relocate:${asset.kind}:${asset.asset_ref}`, async () => {
      const result = await this.dependencies.relocate(asset, location, this.dependencies.key('relocate'));
      this.update({ notice: `${asset.item_name} — ${location.name}` }); this.applyMutations([result]);
    });
  }
  async relocateSelected(location: MovementLocation, assets: readonly MovementAsset[] = this.selectedAssets) {
    if (!assets.length || !this.states.some(row => row.id === location.id)) return;
    await this.run('relocate-batch', async () => {
      const result = await this.dependencies.relocateBatch(assets, location, this.dependencies.key('relocate-batch'));
      this.update({ selected: new Set(), notice: `${assets.length} ta mahsulot — ${location.name}` }); this.applyMutations(result);
    });
  }
  async transfer(asset: MovementAsset, location: MovementLocation) {
    if (!movementAvailable(asset) || asset.physical_location.kind !== 'warehouse' || !this.transferDestinations(asset).some(row => row.id === location.id)) return;
    await this.run(`transfer:${asset.kind}:${asset.asset_ref}`, async () => {
      const transfer = await this.dependencies.transfer(asset, location, this.dependencies.key('transfer'));
      if (!this.current()) return;
      const received = transfer.status === 'received';
      this.update({ notice: received ? `${asset.item_name} — ${location.name} omboriga ko‘chirildi` : 'Transfer so‘rovi yuborildi' });
      for (const direction of ['incoming', 'outgoing'] as const) {
        if (this.transferViews.get(direction)?.trusted) continue;
        const rows = [...this.transfers[direction]], index = rows.findIndex(row => row.id === transfer.id);
        if (index < 0) rows.unshift(transfer); else rows[index] = transfer;
        this.transfers[direction] = rows;
      }
      this.filterTransfers();
      this.applyMutations([received ? { ...asset, custody_warehouse_id: location.warehouse_id, custody_warehouse: location.name,
        status: 'available', physical_location: { id: location.id, kind: location.kind, name: location.name }, transfer_id: '', placement_version: asset.placement_version + 1 }
        : { ...asset, status: 'transfer_reserved', transfer_id: String(transfer.id) }]);
    });
  }
  private applyMutations(mutations: readonly MovementAsset[]) {
    if (!this.current() || !this.locationsView?.rows) return;
    const unique = new Map(mutations.map(asset => [movementAssetKey(asset), asset]));
    const qrAssets = this.state.qrAssets.flatMap(asset => { const next = unique.get(movementAssetKey(asset)) ?? asset; return next.physical_location.kind === 'warehouse' ? [next] : []; });
    if (this.assetView?.trusted) this.update({ qrAssets });
    else {
      const assets = new Map(this.state.assets.map(asset => [movementAssetKey(asset), asset]));
      for (const [key, asset] of unique) {
        const belongs = asset.status.toLowerCase() !== 'deleted' && asset.physical_location.kind === 'warehouse' && this.state.locations.some(row => row.kind === 'warehouse' && row.warehouse_id === this.state.warehouse && row.id === asset.physical_location.id) &&
          [asset.item_code, asset.item_name, asset.identifier, asset.asset_ref].some(value => value.toLowerCase().includes(this.state.query.trim().toLowerCase()));
        if (belongs) assets.set(key, asset); else assets.delete(key);
      }
      this.update({ assets: [...assets.values()], qrAssets, selected: new Set([...this.state.selected].filter(key => assets.has(key))) });
    }
    void this.dependencies.store.reconcileAfterWrite().catch(error => this.update({ notice: message(error) }));
  }
  dispose() {
    this.disposed = true; clearTimeout(this.searchTimer);
    for (const view of [...this.cleanups.keys()]) this.release(view);
    this.listeners.clear();
  }
}
