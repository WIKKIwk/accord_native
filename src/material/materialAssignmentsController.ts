import type { AdminApparatus } from '../apparatusApi';
import type { adminRawMaterialLookup } from '../rawMaterialLookupApi';
import type { productionMapSavedFromJson } from '../workerProductionMapSaved';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import { productionMapAuthorizedOrderApparatus } from '../shared/productionMapAuthorizedApparatus';
import type { RawMaterialAssignmentCandidate, RawMaterialAssignmentDiagnostic } from '../shared/rawMaterialAssignmentApi';
import { dartFutureWait } from '../shared/dartFutureWait';

export type AssignmentOrder = ReturnType<typeof productionMapSavedFromJson>;
export type AssignmentLookup = Awaited<ReturnType<typeof adminRawMaterialLookup>>;
export const materialAssignmentKey = (row: AdminRawMaterialAssignment) => `${row.order_id.trim()}|${row.barcode.trim()}`;
type Choice = (options: readonly string[]) => Promise<string | null>;
type Confirm = () => Promise<boolean>;
export type MaterialAssignmentState = {
  tab: 'manual' | 'qr'; loading: boolean; error: unknown; orders: AssignmentOrder[]; assignments: AdminRawMaterialAssignment[];
  catalog: AdminApparatus[]; selectedOrderId: string; apparatusOptions: readonly string[]; selectedApparatus: string;
  candidates: RawMaterialAssignmentCandidate[]; candidatesLoading: boolean; candidatesError: unknown;
  barcode: string; lookup: AssignmentLookup | null; diagnostic: RawMaterialAssignmentDiagnostic | null;
  scanError: string; scanLoading: boolean; saving: boolean; assigningBarcode: string; unlinkingKey: string;
  expandedKey: string | null; notice: string; noticeTone: 'success' | 'error'; noticeRevision: number;
};
export type MaterialAssignmentDependencies = {
  current(): boolean; assignedApparatus: readonly string[]; text(key: string): string;
  apparatusFilterEnabled?:boolean; sourceLookupCommit?:boolean;
  orders(): Promise<AssignmentOrder[]>; assignments(): Promise<AdminRawMaterialAssignment[]>; apparatus(): Promise<AdminApparatus[]>;
  candidates(order: string, apparatus: string): Promise<RawMaterialAssignmentCandidate[]>;
  lookup(barcode: string): Promise<AssignmentLookup>;
  diagnostic(barcode: string, order: string, apparatus: string): Promise<RawMaterialAssignmentDiagnostic>;
  assign(order: string, barcode: string, apparatus: string): Promise<AdminRawMaterialAssignment>;
  unlink(assignment: AdminRawMaterialAssignment): Promise<unknown>;
};
const errorCode = (error: unknown): string => error && typeof error === 'object' && 'code' in error ? String(error.code) : '';

/** @v2 _AdminRawMaterialAssignmentPanelState */
export class MaterialAssignmentsController {
  private live = true;
  private mounts = 0;
  private started = false;
  private loadGeneration = 0;
  private candidateGeneration = 0;
  private scanGeneration = 0;
  private diagnosticGeneration = 0;
  private listeners = new Set<() => void>();
  private candidatesOrder = '';
  private candidatesApparatus = '';
  private state: MaterialAssignmentState;
  constructor(private readonly deps: MaterialAssignmentDependencies, initialBarcode = '', initialOrderId = '') {
    this.state = { tab: initialBarcode.trim() ? 'qr' : 'manual', loading: true, error: null, orders: [], assignments: [], catalog: [],
      selectedOrderId: initialOrderId, apparatusOptions: [], selectedApparatus: '', candidates: [], candidatesLoading: false, candidatesError: null,
      barcode: '', lookup: null, diagnostic: null, scanError: '', scanLoading: false, saving: false, assigningBarcode: '',
      unlinkingKey: '', expandedKey: null, notice: '', noticeTone: 'success', noticeRevision: 0 };
  }
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  readonly current = () => this.live && this.deps.current();
  readonly isCurrent = () => this.current();
  mount(initialBarcode = '') { this.mounts++; if (!this.started) { this.started = true; void this.start(initialBarcode); } }
  unmount() { this.mounts--; queueMicrotask(() => { if (!this.mounts) this.dispose(); }); }
  private update(patch: Partial<MaterialAssignmentState>) {
    if (!this.current()) return;
    this.state = { ...this.state, ...patch,
      ...(typeof patch.notice === 'string' && patch.notice ? { noticeRevision: this.state.noticeRevision + 1 } : {}) };
    this.listeners.forEach(listener => listener());
  }
  private message(error: unknown, fallback: string) {
    return errorCode(error) && error instanceof Error ? error.message : this.deps.text(fallback);
  }
  async start(initialBarcode = '') {
    const loading = this.refresh();
    // V2 schedules the initial QR after the first frame while the three list reads may still be pending.
    await Promise.resolve();
    if (this.current() && initialBarcode.trim()) await this.scan(initialBarcode);
    await loading;
  }
  async refresh() {
    if (!this.current()) return;
    const generation = ++this.loadGeneration;
    this.update({ loading: true, error: null });
    try {
      const [orders, assignments, catalog] = await dartFutureWait([this.deps.orders(), this.deps.assignments(), this.deps.apparatus()] as const);
      if (!this.current() || generation !== this.loadGeneration) return;
      const selectedOrderId = this.state.selectedOrderId || orders[0]?.map.id.trim() || '';
      this.update({ orders, assignments, catalog, selectedOrderId, loading: false }); this.syncApparatus();
      if (this.state.tab === 'manual') await this.loadCandidates(true);
    } catch (error) { if (generation === this.loadGeneration) this.update({ error, loading: false }); }
  }
  private syncApparatus() {
    if(this.deps.apparatusFilterEnabled===false){this.update({apparatusOptions:[],selectedApparatus:''});return;}
    const order = this.state.orders.find(row => row.map.id.trim() === this.state.selectedOrderId.trim());
    const apparatusOptions = order ? productionMapAuthorizedOrderApparatus(order.map, this.deps.assignedApparatus) : [];
    this.update({ apparatusOptions, selectedApparatus: apparatusOptions.includes(this.state.selectedApparatus)
      ? this.state.selectedApparatus : apparatusOptions[0] ?? '' });
  }
  setTab(tab: 'manual' | 'qr') { this.update({ tab }); if (tab === 'manual') void this.loadCandidates(); }
  selectOrder(id: string) {
    if (this.state.saving || this.state.assigningBarcode || !this.state.orders.some(row => row.map.id.trim() === id.trim())) return;
    this.update({ selectedOrderId: id.trim(), diagnostic: null, candidates: [], candidatesError: null });
    this.syncApparatus(); this.candidatesOrder = ''; this.candidatesApparatus = '';
    void this.refreshDiagnostic();
    // Source eagerly updates the QR tab, and manual candidates refresh on returning to its tab.
    if (this.state.tab === 'qr') void this.loadCandidates(true);
  }
  selectApparatus(id: string) {
    if (this.state.saving || this.state.assigningBarcode || this.state.candidatesLoading || !this.state.apparatusOptions.includes(id.trim())) return;
    if (id.trim() === this.state.selectedApparatus) return;
    this.update({ selectedApparatus: id.trim(), diagnostic: null, candidates: [], candidatesError: null });
    this.candidatesOrder = ''; this.candidatesApparatus = '';
    void this.refreshDiagnostic(); void this.loadCandidates(true);
  }
  async loadCandidates(force = false) {
    const order = this.state.selectedOrderId.trim(), apparatus = this.state.selectedApparatus.trim();
    if (!this.current() || !order || (this.candidatesOrder === order && this.candidatesApparatus === apparatus &&
      (this.state.candidatesLoading || (!force && !this.state.candidatesError)))) return;
    const generation = ++this.candidateGeneration;
    this.candidatesOrder = order; this.candidatesApparatus = apparatus;
    this.update({ candidatesLoading: true, candidatesError: null, candidates: [] });
    const current = () => this.current() && generation === this.candidateGeneration && order === this.state.selectedOrderId.trim() && apparatus === this.state.selectedApparatus.trim();
    try { const candidates = await this.deps.candidates(order, apparatus); if (current()) this.update({ candidates }); }
    catch (candidatesError) { if (current()) this.update({ candidatesError }); }
    finally { if (current()) this.update({ candidatesLoading: false }); }
  }
  retryCandidates() { return this.loadCandidates(true); }
  async scan(raw: string) {
    const barcode = rawMaterialBarcodeFromQr(raw); if (!this.current() || !barcode) return;
    const generation = ++this.scanGeneration; ++this.diagnosticGeneration;
    this.update({ barcode, lookup: null, diagnostic: null, scanError: '', scanLoading: true });
    const current = () => this.current() && generation === this.scanGeneration && barcode === this.state.barcode;
    try {
      const lookup = await this.deps.lookup(barcode); if (!current()) return;
      if(this.deps.sourceLookupCommit){
        let diagnostic:RawMaterialAssignmentDiagnostic|null=null,scanError='';const order=this.state.selectedOrderId.trim(),apparatus=this.state.selectedApparatus.trim(),request=++this.diagnosticGeneration;
        if(!lookup.assignment&&order){try{diagnostic=await this.deps.diagnostic(barcode,order,apparatus);}catch(error){scanError=this.message(error,'production.assignment.diagnostic_failed');}}
        if(!current())return;const diagnosticCurrent=request===this.diagnosticGeneration&&order===this.state.selectedOrderId.trim()&&apparatus===this.state.selectedApparatus.trim();
        this.update({lookup,...(diagnosticCurrent?{diagnostic,scanError}:{})});if(!diagnosticCurrent&&!lookup.assignment)void this.refreshDiagnostic();return;
      }
      this.update({ lookup });
      if (!lookup.assignment) await this.refreshDiagnostic();
    } catch (error) { if (current()) this.update({ scanError: this.message(error, 'raw_material.not_found'), diagnostic: null }); }
    finally { if (current()) this.update({ scanLoading: false }); }
  }
  private async refreshDiagnostic() {
    const generation = ++this.diagnosticGeneration, { barcode, selectedOrderId: order, selectedApparatus: apparatus, lookup } = this.state;
    if (!this.current() || !barcode || !order || lookup?.assignment) return;
    const current = () => this.current() && generation === this.diagnosticGeneration && barcode === this.state.barcode &&
      order === this.state.selectedOrderId && apparatus === this.state.selectedApparatus;
    try { const diagnostic = await this.deps.diagnostic(barcode, order, apparatus); if (current()) this.update({ diagnostic, scanError: '' }); }
    catch (error) { if (current()) this.update({ diagnostic: null, scanError: this.message(error, 'production.assignment.diagnostic_failed') }); }
  }
  private install(saved: AdminRawMaterialAssignment, scanned: boolean) {
    this.update({ assignments: [saved, ...this.state.assignments.filter(row => materialAssignmentKey(row) !== materialAssignmentKey(saved))],
      ...(scanned ? { barcode: '', lookup: null, diagnostic: null, scanError: '' } :
        { candidates: this.state.candidates.filter(row => row.barcode.trim().toUpperCase() !== saved.barcode.trim().toUpperCase()) }),
      notice: this.deps.text('raw_material.assigned'), noticeTone: 'success' });
  }
  async save(choose: Choice) {
    const order = this.state.selectedOrderId.trim(), barcode = rawMaterialBarcodeFromQr(this.state.barcode);
    if (!this.current()) return;
    if (!order || !barcode || this.state.saving) { this.update({ notice: this.deps.text('raw_material.order_scan_required'), noticeTone: 'error' }); return; }
    this.update({ saving: true });
    try {
      let saved: AdminRawMaterialAssignment;
      try { saved = await this.deps.assign(order, barcode, ''); }
      catch (error) {
        if (!this.current()) return;
        const diagnostics = error && typeof error === 'object' && 'diagnostics' in error ? error.diagnostics as Record<string, unknown> : null;
        const options = diagnostics?.apparatus_options;
        if (errorCode(error) !== 'raw_material_group_ambiguous' || !Array.isArray(options) || !options.length) throw error;
        const apparatus = await choose(options.map(String)); if (!this.current()) return;
        if (apparatus === null) { this.update({ notice: this.deps.text('raw_material.assign_cancelled'), noticeTone: 'error' }); return; }
        saved = await this.deps.assign(order, barcode, apparatus);
      }
      if (this.current()) this.install(saved, true);
    } catch (error) { this.update({ notice: this.message(error, 'raw_material.assign_failed'), noticeTone: 'error' }); }
    finally { this.update({ saving: false }); }
  }
  async assignCandidate(candidate: RawMaterialAssignmentCandidate, confirm: Confirm, choose: Choice) {
    if (!this.current() || this.state.assigningBarcode || this.state.saving) return;
    if (!await confirm() || !this.current()) return;
    this.update({ assigningBarcode: candidate.barcode.trim() });
    try {
      const options = candidate.apparatus_options;
      const apparatus = options.length === 1 ? options[0] : await choose(options);
      if (!this.current() || apparatus === null) return;
      const saved = await this.deps.assign(this.state.selectedOrderId, candidate.barcode, apparatus);
      if (this.current()) this.install(saved, false);
    } catch (error) { this.update({ notice: this.message(error, 'raw_material.assign_failed'), noticeTone: 'error' }); await this.loadCandidates(true); }
    finally { this.update({ assigningBarcode: '' }); }
  }
  async unlink(assignment: AdminRawMaterialAssignment, confirm: Confirm) {
    if (!this.current() || this.state.saving || this.state.unlinkingKey) return;
    if (!await confirm() || !this.current()) return;
    const key = materialAssignmentKey(assignment); this.update({ unlinkingKey: key });
    try {
      await this.deps.unlink(assignment); if (!this.current()) return;
      const scanned = this.state.lookup;
      this.update({ assignments: this.state.assignments.filter(row => materialAssignmentKey(row) !== key),
        expandedKey: this.state.expandedKey === key ? null : this.state.expandedKey,
        ...(scanned?.assignment && materialAssignmentKey(scanned.assignment) === key ? { lookup: { ...scanned, assignment: null,
          reserved_order_id: '', status: 'available', order: null, queue_states: {} }, diagnostic: null } : {}),
        notice: this.deps.text('raw_material.unlinked'), noticeTone: 'success' });
      if (this.candidatesOrder === assignment.order_id.trim()) await this.loadCandidates(true);
    } catch (error) { this.update({ notice: this.message(error, 'raw_material.unlink_failed'), noticeTone: 'error' }); }
    finally { this.update({ unlinkingKey: '' }); }
  }
  expand(expandedKey: string | null) { this.update({ expandedKey }); }
  dismissNotice() { this.update({ notice: '' }); }
  dispose() { this.live = false; this.loadGeneration++; this.candidateGeneration++; this.scanGeneration++; this.diagnosticGeneration++; this.listeners.clear(); }
}
