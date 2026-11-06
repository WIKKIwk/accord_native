import type { GScaleBatchSession, materialReceiptPrintResponseFromJson } from './gscaleBatchModel';
import { GScaleBatchStateStore, type GScaleBatchState } from './gscaleBatchState';
import { GScaleDeviceStore, type GScaleDeviceState } from './gscaleDeviceState';
import type { GScaleLiveMonitor } from './gscaleLive';
import { emptyMonitorSnapshot, mergeLiveMonitorWithRsBatch, monitorSnapshotWithBatch, type MonitorSnapshot } from './gscaleMonitor';
import { emptyOperatorControlDraft, restoreOperatorDraft, type OperatorControlDraft } from './gscaleDraft';
import { autoBatchPrintKey, canTriggerGrossPrint, hasCompleteRpsBatchPrintContext, normalizePrinterChoice, normalizeQuantitySource,
  parseManualDuplicateCount, parsePositiveKg, parseScaleDisplayKg, rpsBatchActionErrorMessage, shouldTriggerAutoBatchPrint } from './gscaleControlLogic';
import { formatCompactKg, preparationPresetConflict } from './gscalePreparation';
import type { GScaleModeArgs } from './gscaleRouteArgs';
import type { GScaleStartContext } from './gscaleBatchStart';
import type { GScalePrintContext } from './gscaleBatchPrint';
import type { DiscoveredServer } from './gscaleDiscovery';
import { MobileApiException } from '../shared/mobileApiException';

type Receipt = ReturnType<typeof materialReceiptPrintResponseFromJson>;
type Item = { code: string; name: string; requiresDimensions: boolean };
export type GScaleOperatorDependencies = {
  devices: GScaleDeviceStore; batch: GScaleBatchStateStore;
  refreshProfileScope(): Promise<void>;
  loadDraft(): Promise<OperatorControlDraft>; saveDraft(draft: OperatorControlDraft): Promise<void>;
  loadPreparationPreset(): Promise<Item | null>; loadMaterialWarehouses(): Promise<string[]>;
  warehouseAllowed(warehouse: string): Promise<boolean>;
  startBatch(context: GScaleStartContext, choose: (options: Record<string, string>) => Promise<string | null>): Promise<{ batch: GScaleBatchSession }>;
  printBatch(context: GScalePrintContext): Promise<Receipt>;
  submitSimple(itemCode: string | null, warehouse: string, quantity: string, materialWarehouses: string[]): Promise<void>;
  refreshMonitor(baseUrl: string): Promise<MonitorSnapshot>;
  makeLive(server: DiscoveredServer, callbacks: { onSnapshot(snapshot: MonitorSnapshot): void; onError(message: string): void;
    onLatency(milliseconds: number): void; onUnavailable(message: string): void }): GScaleLiveMonitor;
};
export type GScaleOperatorState = { draft: OperatorControlDraft; device: GScaleDeviceState; batch: GScaleBatchState;
  monitor: MonitorSnapshot; materialWarehouses: string[]; presetLoading: boolean; presetApplied: boolean; presetItem: Item | null;
  presetError: string; contextEditing: boolean; actionLoading: boolean; manualPrintLoading: boolean; simpleLoading: boolean;
  requestInFlight: boolean; startConflict: boolean; error: string; notice: string; lastReceipt: Receipt | null };

/** Shared dashboard state. Platform views bind to this controller. */
export class GScaleOperatorStore {
  private state: GScaleOperatorState;
  private listeners = new Set<() => void>();
  private subscriptions: (() => void)[] = [];
  private live: GScaleLiveMonitor | null = null;
  private deviceKey = '';
  private lastBatch: GScaleBatchSession | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoPrintKey = '';
  private qtyBackup = '';
  private qtyCleared = false;
  private alive = true;
  private readonly controlOnly: boolean;
  private readonly linkedOrderId: string;

  constructor(private readonly role: string, private readonly args: GScaleModeArgs, private readonly deps: GScaleOperatorDependencies) {
    this.controlOnly = role === 'material_taminotchi' || role === 'tayyorlov_masteri';
    this.linkedOrderId = args.order?.id.trim() ?? '';
    const draft = { ...emptyOperatorControlDraft(), order_id: this.linkedOrderId, printer: 'zebra', print_mode: 'rfid', quantity_source: 'scale' };
    this.state = { draft, device: deps.devices.getSnapshot(), batch: deps.batch.getSnapshot(), monitor: emptyMonitorSnapshot(),
      materialWarehouses: [], presetLoading: this.controlOnly && !!args.freshForm, presetApplied: false, presetItem: null,
      presetError: '', contextEditing: false, actionLoading: false, manualPrintLoading: false, simpleLoading: false,
      requestInFlight: false, startConflict: false, error: '', notice: '', lastReceipt: null };
    this.deviceKey = `${this.state.device.transport}|`;
  }
  getSnapshot = () => this.state;
  isActive = () => this.alive;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(patch: Partial<GScaleOperatorState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = null; if (this.alive) void this.deps.saveDraft(this.state.draft); }, 180);
  }
  private setDraft(draft: OperatorControlDraft, save = true) { this.update({ draft }); if (save) this.scheduleSave(); }
  private get usesOrder() { return (this.controlOnly && this.role === 'material_taminotchi') || (this.controlOnly && !!this.args.freshForm); }
  private get selectedServer(): DiscoveredServer | null {
    const selected = this.state.device.selection;
    return selected?.transport === 'wifi' ? selected.server : null;
  }

  start(): void {
    this.subscriptions.push(this.deps.devices.subscribe(() => this.deviceChanged()), this.deps.batch.subscribe(() => this.batchChanged()));
    void this.restoreDraft();
    void this.deps.devices.restore();
    if (this.controlOnly) { void this.deps.batch.refresh(); void this.refreshMaterialWarehouses(); void this.deps.refreshProfileScope().catch(() => {}); }
    this.deviceChanged();
  }

  private async restoreDraft() {
    const saved = await this.deps.loadDraft();
    if (!this.alive) return;
    const active = this.state.batch.batch?.active === true;
    const draft = restoreOperatorDraft(this.state.draft, saved, { materialReceipt: this.controlOnly && this.role === 'material_taminotchi',
      linkedOrderId: this.linkedOrderId, linkedOrderWidthMm: this.args.order?.width_mm ?? null,
      initialWarehouse: this.args.warehouse ?? null, activeBatch: active, freshForm: this.controlOnly && !!this.args.freshForm });
    this.setDraft(draft, false);
    if (this.controlOnly && this.args.freshForm) {
      try {
        const item = await this.deps.loadPreparationPreset();
        if (!this.alive) return;
        this.update({ presetLoading: false, presetItem: item });
        this.tryApplyPreset();
        if (this.state.batch.batch?.active) this.update({ error: this.preparationConflict() });
      } catch (error) { this.update({ presetLoading: false, presetError: error instanceof Error ? error.message : String(error) }); }
    }
  }

  private tryApplyPreset() {
    if (!this.controlOnly || !this.args.freshForm || this.state.presetApplied || this.state.presetLoading ||
        !this.state.batch.resolved || this.state.batch.batch?.active || !this.state.presetItem) return;
    const item = this.state.presetItem;
    this.setDraft({ ...this.state.draft, item_code: item.code, item_name: item.name || item.code,
      item_requires_dimensions: item.requiresDimensions, order_id: this.linkedOrderId });
    this.update({ presetApplied: true });
  }

  private async refreshMaterialWarehouses() {
    if (!this.controlOnly || this.role !== 'tayyorlov_masteri') return;
    try { const names = await this.deps.loadMaterialWarehouses(); this.update({ materialWarehouses: names.map(value => value.trim().toLowerCase()).filter(Boolean) }); }
    catch { /* The V2 screen retains the previous scope. */ }
  }

  private deviceChanged() {
    const device = this.deps.devices.getSnapshot();
    this.update({ device });
    const server = device.selection?.transport === 'wifi' ? device.selection.server : null;
    const key = `${device.transport}|${server?.endpoint.baseUrl ?? ''}`;
    if (key === this.deviceKey) return;
    this.deviceKey = key;
    this.live?.stop(); this.live = null;
    this.deps.batch.reset(); this.lastBatch = null; this.autoPrintKey = '';
    this.update({ monitor: { ...emptyMonitorSnapshot(), latencyMs: server?.latencyMs ?? 0 }, error: '', requestInFlight: false });
    if (server) {
      this.live = this.deps.makeLive(server, {
        onSnapshot: snapshot => this.acceptMonitor(snapshot), onError: error => this.update({ error }),
        onLatency: latencyMs => this.update({ monitor: { ...this.state.monitor, latencyMs } }),
        onUnavailable: error => { this.update({ error }); this.deps.devices.clearServer(); },
      });
      this.live.start(); void this.refresh();
    }
    if (this.controlOnly || server || device.transport !== 'wifi') void this.deps.batch.refresh();
  }

  private batchChanged() {
    const batchState = this.deps.batch.getSnapshot(), batch = batchState.batch;
    this.update({ batch: batchState, ...(batchState.error ? { error: batchState.error } : {}) });
    if (!batch || batch === this.lastBatch) return;
    this.lastBatch = batch;
    let draft = this.state.draft;
    if (batch.active && !this.state.contextEditing) {
      draft = { ...draft, ...(this.usesOrder ? { order_id: batch.order_id, item_code: batch.item_code, item_name: batch.item_name,
        item_requires_dimensions: batch.width_mm != null || batch.micron != null, warehouse: batch.warehouse,
        warehouse_mode: 'manual' as const, context_saved: true } : {}),
        printer: normalizePrinterChoice(batch.printer), print_mode: batch.print_mode.trim().toLowerCase() === 'label' ? 'label' : 'rfid',
        quantity_source: normalizeQuantitySource(batch.quantity_source), babina_enabled: batch.tare_enabled,
        babina_text: batch.tare_enabled && batch.tare_kg > 0 ? formatCompactKg(batch.tare_kg) : '',
        width_text: batch.width_mm == null ? '' : formatCompactKg(batch.width_mm),
        micron_text: batch.micron == null ? '' : formatCompactKg(batch.micron), length_text: batch.length_m == null ? '' : formatCompactKg(batch.length_m) };
    }
    this.update({ draft, monitor: monitorSnapshotWithBatch(this.state.monitor, batch), ...(!batch.active ? { contextEditing: false, startConflict: false } : {}) });
    if (!batch.active) { this.autoPrintKey = ''; this.tryApplyPreset(); }
    else this.maybeAutoPrint();
  }

  private acceptMonitor(snapshot: MonitorSnapshot) {
    const monitor = { ...mergeLiveMonitorWithRsBatch(snapshot, this.state.monitor), latencyMs: this.state.monitor.latencyMs };
    this.update({ monitor, ...(!this.state.startConflict ? { error: '' } : {}) });
    this.maybeAutoPrint();
  }

  async refresh(): Promise<void> {
    if (this.state.requestInFlight) return;
    const server = this.selectedServer;
    if (!server) { if (this.state.device.transport === 'wifi') this.update({ error: 'Avval printer yoki tarozini tanlang' }); return; }
    this.update({ requestInFlight: true });
    try {
      const snapshot = await this.deps.refreshMonitor(server.endpoint.baseUrl);
      if (!this.alive || this.selectedServer?.endpoint.baseUrl !== server.endpoint.baseUrl) return;
      this.acceptMonitor(snapshot);
      await this.deps.batch.refresh();
    } catch (error) {
      if (this.alive) { this.update({ error: String(error) }); this.deps.devices.clearServer(); }
    } finally { this.update({ requestInFlight: false }); }
  }

  editDraft(patch: Partial<OperatorControlDraft>): void {
    if (this.state.actionLoading || this.state.batch.loading || this.state.manualPrintLoading || this.state.simpleLoading) return;
    const editableDuringBatch = new Set(['manual_qty_text', 'manual_duplicate_text', 'material_supplier']);
    const changesContext = Object.keys(patch).some(key => !editableDuringBatch.has(key));
    if (changesContext && (this.state.batch.batch?.active || (this.usesOrder && !this.state.batch.resolved) || this.state.presetLoading)) return;
    this.setDraft({ ...this.state.draft, ...patch });
  }
  selectItem(item: Item): void {
    const draft = this.state.draft, changed = draft.item_code !== item.code;
    this.editDraft({ item_code: item.code, item_name: item.name || item.code, item_requires_dimensions: item.requiresDimensions,
      context_saved: false, ...(changed ? { micron_text: '', ...(this.usesOrder ? { length_text: '' } : {}),
        ...(!(this.role === 'material_taminotchi' && this.linkedOrderId) ? { width_text: '' } : {}),
        ...(!['material_taminotchi', 'tayyorlov_masteri'].includes(this.role) ? { warehouse: '' } : {}) } : {}) });
  }
  handleManualQtyTap(): void {
    if (this.qtyCleared || !this.state.draft.manual_qty_text.trim()) return;
    this.qtyBackup = this.state.draft.manual_qty_text; this.qtyCleared = true;
    this.editDraft({ manual_qty_text: '' });
  }
  restoreManualQtyIfEmpty(): void {
    if (!this.qtyCleared) return;
    this.qtyCleared = false;
    if (!this.state.draft.manual_qty_text.trim() && this.qtyBackup.trim()) this.editDraft({ manual_qty_text: this.qtyBackup });
  }

  async saveContext(forBatchStart = false): Promise<boolean> {
    if ((!this.state.contextEditing && this.state.draft.context_saved) || this.state.manualPrintLoading || this.state.batch.loading ||
        (this.state.actionLoading && !forBatchStart) || this.state.requestInFlight) return false;
    const draft = this.state.draft, batch = this.state.batch.batch;
    if (batch?.active) { this.update({ error: 'Avval To‘xtatish tugmasini bosing, keyin homashyoni o‘zgartiring.' }); return false; }
    const width = parsePositiveKg(draft.width_text), micron = parsePositiveKg(draft.micron_text), length = parsePositiveKg(draft.length_text);
    const error = !draft.item_code ? 'Mahsulot tanlang' : draft.item_requires_dimensions && width == null ? "Material enini mm da to'g'ri kiriting" :
      draft.item_requires_dimensions && micron == null ? "Material mikronini to'g'ri kiriting" : length == null ? "Material metrajini metrda to'g'ri kiriting" :
      !(draft.warehouse_mode === 'default' ? draft.default_warehouse : draft.warehouse).trim() ? 'Ombor tanlang' : '';
    if (error) { this.update({ error }); return false; }
    const warehouse = draft.warehouse_mode === 'default' ? draft.default_warehouse : draft.warehouse;
    if (!await this.deps.warehouseAllowed(warehouse)) { this.update({ error: 'Bu ombor sizga biriktirilmagan' }); return false; }
    if (!this.alive || this.state.batch.batch?.active || this.state.draft.order_id !== draft.order_id) {
      this.update({ error: 'Order yoki batch holati o‘zgardi. Qayta tekshiring.' }); return false;
    }
    this.setDraft({ ...this.state.draft, context_saved: true });
    this.update({ contextEditing: false, error: '' });
    return true;
  }

  beginContextEdit(): void {
    if (this.state.actionLoading) return;
    if (this.state.batch.batch?.active) { this.update({ error: 'Avval To‘xtatish tugmasini bosing, keyin homashyoni o‘zgartiring.' }); return; }
    if (this.state.draft.context_saved) { this.setDraft({ ...this.state.draft, context_saved: false }); this.update({ contextEditing: true, error: '' }); }
  }

  async startBatch(choose: (options: Record<string, string>) => Promise<string | null>, autoPrintStable: boolean): Promise<void> {
    if (this.state.manualPrintLoading || this.state.actionLoading || this.state.batch.loading || this.state.requestInFlight) return;
    if (!this.state.batch.resolved || this.state.batch.batch?.active) { this.update({ error: 'Avval faol batchni to‘xtating va holatni yangilang' }); return; }
    this.update({ actionLoading: true, startConflict: false, error: '' });
    try {
      if ((this.state.contextEditing || !this.state.draft.context_saved) && !await this.saveContext(true)) return;
      const draft = this.state.draft, selected = this.state.device.selection;
      const result = await this.deps.startBatch({ batchResolved: this.state.batch.resolved, batch: this.state.batch.batch,
        linkedOrderId: this.linkedOrderId, draftOrderId: draft.order_id, usesReceiptOrderContext: this.usesOrder,
        preparationFormulaReceipt: this.controlOnly && !!this.args.freshForm, initialMaterialId: this.args.materialId ?? '',
        formulaVariantId: this.args.formulaVariantId ?? '', transport: this.state.device.transport, server: this.selectedServer,
        item: draft.item_code ? { code: draft.item_code, name: draft.item_name, requiresDimensions: draft.item_requires_dimensions } : null,
        warehouse: draft.warehouse_mode === 'default' ? draft.default_warehouse : draft.warehouse,
        widthText: draft.width_text, micronText: draft.micron_text, lengthText: draft.length_text,
        babinaEnabled: draft.babina_enabled, babinaText: draft.babina_text,
        offlinePrinter: selected?.transport === 'offline' ? selected.offlinePrinter : null,
        bluetoothPrinter: selected?.transport === 'bluetooth' ? selected.bluetoothPrinter : null,
        batchPrinter: draft.printer, batchPrintMode: draft.print_mode, quantitySource: draft.quantity_source, grossQtyKg: 0 }, choose);
      if (this.alive) { this.deps.batch.apply(result.batch); this.autoPrintKey = ''; this.scheduleSave(); }
    } catch (error) {
      if (error instanceof MobileApiException && error.code === 'batch_already_active') {
        await this.deps.batch.refresh();
        const activeOrder = this.state.batch.batch?.order_id ?? '';
        this.update({ startConflict: true, error: activeOrder && activeOrder !== this.linkedOrderId
          ? `Boshqa order uchun batch faol: ${activeOrder}. Avval uni to‘xtating.`
          : 'Batch allaqachon faol. Holatni tekshirib, avval uni to‘xtating.' });
      } else this.update({ error: rpsBatchActionErrorMessage(error) });
    }
    finally { this.update({ actionLoading: false }); }
    if (autoPrintStable && !this.state.error) this.maybeAutoPrint();
  }

  async stopBatch(): Promise<void> {
    if (this.state.manualPrintLoading || this.state.actionLoading || this.state.batch.loading || this.state.requestInFlight) return;
    await this.deps.batch.stop(); this.autoPrintKey = '';
  }

  private preparationConflict(): string {
    return preparationPresetConflict({ freshForm: !!this.args.freshForm, controlOnly: this.controlOnly, orderId: this.linkedOrderId,
      materialId: this.args.materialId ?? '', variantId: this.args.formulaVariantId ?? '', itemCode: this.state.presetItem?.code ?? null,
      applied: this.state.presetApplied, batch: this.state.batch.batch });
  }

  private async print(gross: number, count: number, auto: boolean): Promise<void> {
    const selection = this.state.device.selection, batch = this.state.batch.batch;
    this.update(auto ? { actionLoading: true, error: '' } : { manualPrintLoading: true, error: '' });
    try {
      const response = await this.deps.printBatch({ preparationConflict: this.preparationConflict(), transport: this.state.device.transport,
        server: this.selectedServer, batchResolved: this.state.batch.resolved, batch, linkedOrderId: this.linkedOrderId,
        grossQtyKg: gross, printCount: count, isMaterialReceipt: this.controlOnly && this.role === 'material_taminotchi',
        materialSupplier: this.state.draft.material_supplier,
        offlinePrinter: selection?.transport === 'offline' ? selection.offlinePrinter : null,
        bluetoothPrinter: selection?.transport === 'bluetooth' ? selection.bluetoothPrinter : null });
      this.update({ lastReceipt: response });
      this.scheduleSave(); void this.refresh();
    } catch (error) { this.update({ error: rpsBatchActionErrorMessage(error) }); }
    finally { this.update(auto ? { actionLoading: false } : { manualPrintLoading: false }); }
  }

  async manualPrint(): Promise<void> {
    if (this.state.manualPrintLoading || this.state.actionLoading || this.state.batch.loading || this.state.requestInFlight) return;
    if (this.state.contextEditing) { this.update({ error: 'Avval Saqlash tugmasini bosing.' }); return; }
    this.restoreManualQtyIfEmpty();
    if (!this.state.monitor.batchActive || normalizeQuantitySource(this.state.monitor.batchQuantitySource) !== 'manual') {
      this.update({ error: 'Avval qo‘lda print uchun Boshlash ni bosing' }); return;
    }
    const draft = this.state.draft, kg = parsePositiveKg(draft.manual_qty_text), count = parseManualDuplicateCount(draft.manual_duplicate_text);
    if (!canTriggerGrossPrint(kg, draft.babina_enabled, draft.babina_text) || count == null) {
      this.update({ error: count == null ? "Duplicate sonini to'g'ri kiriting" : "Manual kg ni to'g'ri kiriting" }); return;
    }
    await this.print(kg!, count, false);
  }

  async submitSimpleReceipt(): Promise<void> {
    if (this.state.manualPrintLoading || this.state.actionLoading || this.state.batch.loading || this.state.requestInFlight || this.state.simpleLoading) return;
    const draft = this.state.draft;
    const warehouse = draft.warehouse_mode === 'default' ? draft.default_warehouse : draft.warehouse;
    this.update({ simpleLoading: true, error: '', notice: '' });
    try {
      await this.deps.submitSimple(draft.item_code || null, warehouse, draft.manual_qty_text, this.state.materialWarehouses);
      if (!this.alive) return;
      this.qtyBackup = ''; this.qtyCleared = false;
      this.setDraft({ ...this.state.draft, manual_qty_text: '' });
      this.update({ notice: 'Sodda kirim saqlandi' });
    } catch (error) { this.update({ error: error instanceof Error ? error.message : String(error) }); }
    finally { this.update({ simpleLoading: false }); }
  }

  private maybeAutoPrint(): void {
    const batch = this.state.batch.batch;
    if (this.state.startConflict || !this.state.batch.resolved || !batch?.active || !hasCompleteRpsBatchPrintContext(batch) || this.preparationConflict() ||
        normalizeQuantitySource(this.state.monitor.batchQuantitySource) !== 'scale') { this.autoPrintKey = ''; return; }
    const draft = this.state.draft, gross = parseScaleDisplayKg(this.state.monitor.scaleValue);
    const key = autoBatchPrintKey(gross, this.state.monitor.scaleStable, draft.babina_enabled, draft.babina_text);
    if (!key) { if (!this.state.actionLoading) this.autoPrintKey = ''; return; }
    if (!shouldTriggerAutoBatchPrint(this.state.monitor.batchActive,
      this.state.manualPrintLoading || this.state.actionLoading || this.state.batch.loading || this.state.requestInFlight, key, this.autoPrintKey)) return;
    this.autoPrintKey = key;
    queueMicrotask(() => { if (this.alive && gross != null) void this.print(gross, 1, true); });
  }

  dispose(): void {
    this.alive = false; if (this.saveTimer) clearTimeout(this.saveTimer);
    this.live?.stop(); for (const unsubscribe of this.subscriptions) unsubscribe(); this.listeners.clear();
    this.deps.devices.dispose(); this.deps.batch.dispose();
  }
}
