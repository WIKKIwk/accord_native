import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import type { RawMaterialAssignmentCandidate, RawMaterialAssignmentDiagnostic } from '../shared/rawMaterialAssignmentApi';
import type { AdminRawMaterialAssignment } from '../workerRawMaterials';
import { materialDiagnosticMessage } from './materialAssignmentPresentation';

type Candidate = RawMaterialAssignmentCandidate;
export type SequenceAssignmentText = (key: string, values?: Record<string, unknown>) => string;
export type MaterialSequenceAssignmentState = {
  candidates: Candidate[]; assignments: AdminRawMaterialAssignment[]; loading: boolean; loadError: string;
  actionMessage: string; actionSucceeded: boolean; assigningBarcode: string; bulkAssigning: boolean;
  scannerVisible: boolean; scannerStatus: string; selectedApparatus: string; selectedKeys: ReadonlySet<string>;
};
export type SequenceAssignmentDependencies = {
  current(): boolean; text: SequenceAssignmentText; now?(): number;
  candidates(apparatus: string): Promise<Candidate[]>;
  assignments(apparatus: string): Promise<AdminRawMaterialAssignment[]>;
  diagnostic(barcode: string, apparatus: string): Promise<RawMaterialAssignmentDiagnostic>;
  assign(barcode: string, apparatus: string): Promise<AdminRawMaterialAssignment>;
};
export const sequenceAssignmentBarcodeKey = (barcode: string) => barcode.trim().toUpperCase();
const candidateOptions = (candidate: Candidate) => candidate.apparatus_options.map(value => value.trim()).filter(Boolean);

/** @v2 _SequenceRawMaterialAssignmentSheetState */
export class MaterialSequenceAssignmentController {
  private state: MaterialSequenceAssignmentState;
  private listeners = new Set<() => void>();
  private disposed = false;
  private mounts = 0;
  private started = false;
  private readGeneration = 0;
  private diagnosticGeneration = 0;
  private lastCode = '';
  private lastAt: number | null = null;
  constructor(private readonly dependencies: SequenceAssignmentDependencies, readonly orderId: string,
    readonly apparatusOptions: readonly string[], initialApparatus: string) {
    const selected = apparatusOptions.find(id => id.trim() === initialApparatus.trim()) ?? apparatusOptions[0] ?? '';
    this.state = { candidates: [], assignments: [], loading: true, loadError: '', actionMessage: '', actionSucceeded: false,
      assigningBarcode: '', bulkAssigning: false, scannerVisible: false, scannerStatus: dependencies.text('production.assignment.qr_prompt'),
      selectedApparatus: selected, selectedKeys: new Set() };
  }
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  readonly current = () => !this.disposed && this.dependencies.current();
  private update(patch: Partial<MaterialSequenceAssignmentState>) {
    if (!this.current()) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private message(error: unknown, fallback: string) {
    return error instanceof Error && 'code' in error ? error.message : this.dependencies.text(fallback);
  }
  mount() { this.mounts++; if (!this.started) { this.started = true; void this.load(); } }
  unmount() { this.mounts--; queueMicrotask(() => { if (!this.mounts) this.dispose(); }); }
  async load(showLoading = true) {
    if (!this.current()) return;
    const id = this.orderId.trim(), apparatus = this.state.selectedApparatus.trim(), generation = ++this.readGeneration;
    if (!id) { this.update({ loading: false, loadError: this.dependencies.text('production.assignment.order_missing') }); return; }
    if (!apparatus) { this.update({ candidates: [], assignments: [], loading: false, loadError: '' }); return; }
    if (showLoading) this.update({ loading: true, loadError: '' });
    try {
      const [candidates, assignments] = await Promise.all([this.dependencies.candidates(apparatus), this.dependencies.assignments(apparatus)]);
      if (!this.current() || generation !== this.readGeneration || apparatus !== this.state.selectedApparatus.trim()) return;
      const available = new Set(candidates.map(candidate => sequenceAssignmentBarcodeKey(candidate.barcode)));
      this.update({ candidates, assignments, loading: false, loadError: '', selectedKeys: new Set([...this.state.selectedKeys].filter(key => available.has(key))) });
    } catch (error) {
      if (generation === this.readGeneration && apparatus === this.state.selectedApparatus.trim()) this.update({ loading: false,
        loadError: this.message(error, 'production.assignment.load_failed') });
    }
  }
  private busy() { return this.state.bulkAssigning || !!this.state.assigningBarcode; }
  toggleSelection(candidate: Candidate) {
    if (!this.current() || this.busy()) return;
    const key = sequenceAssignmentBarcodeKey(candidate.barcode); if (!key) return;
    const selected = new Set(this.state.selectedKeys);
    if (selected.has(key)) selected.delete(key); else selected.add(key);
    this.update({ selectedKeys: selected, actionMessage: '' });
  }
  clearSelection() { if (!this.state.bulkAssigning) this.update({ selectedKeys: new Set(), actionMessage: '' }); }
  toggleScanner() {
    if (!this.current() || this.busy()) return;
    this.diagnosticGeneration++;
    const scannerVisible = !this.state.scannerVisible;
    if (scannerVisible) { this.lastCode = ''; this.lastAt = null; }
    this.update({ scannerVisible, ...(scannerVisible ? { scannerStatus: this.dependencies.text('production.assignment.qr_prompt') } : {}) });
  }
  selectApparatus(value: string) {
    if (!this.current() || this.busy()) return;
    const apparatus = value.trim();
    if (!apparatus || apparatus === this.state.selectedApparatus.trim() || !this.apparatusOptions.includes(apparatus)) return;
    this.diagnosticGeneration++; this.lastCode = ''; this.lastAt = null;
    this.update({ selectedApparatus: apparatus, selectedKeys: new Set(), candidates: [], assignments: [], actionMessage: '',
      scannerStatus: this.dependencies.text('production.assignment.qr_prompt') });
    void this.load();
  }
  async handleScan(raw: string) {
    if (!this.current() || this.state.loading || this.busy()) return;
    const barcode = rawMaterialBarcodeFromQr(raw).trim(), key = sequenceAssignmentBarcodeKey(barcode); if (!key) return;
    const now = this.dependencies.now?.() ?? Date.now();
    if (key === this.lastCode && this.lastAt !== null && now - this.lastAt < 2000) return;
    this.lastCode = key; this.lastAt = now;
    const generation = ++this.diagnosticGeneration, apparatus = this.state.selectedApparatus.trim();
    const candidate = this.state.candidates.find(row => sequenceAssignmentBarcodeKey(row.barcode) === key);
    if (!candidate) {
      const current = () => this.current() && generation === this.diagnosticGeneration && this.lastCode === key && this.state.selectedApparatus.trim() === apparatus;
      try {
        const diagnostic = await this.dependencies.diagnostic(barcode, apparatus);
        if (current()) this.update({ scannerStatus: diagnostic.compatible ? this.dependencies.text('production.assignment.diagnostic_compatible_refresh')
          : materialDiagnosticMessage(diagnostic, this.dependencies.text) });
      } catch (error) { if (current()) this.update({ scannerStatus: this.message(error, 'production.assignment.diagnostic_failed') }); }
      return;
    }
    if (!apparatus || !candidateOptions(candidate).includes(apparatus)) {
      this.update({ scannerStatus: this.dependencies.text('production.assignment.qr_wrong_apparatus') }); return;
    }
    const selectedKeys = new Set(this.state.selectedKeys), already = selectedKeys.has(key); selectedKeys.add(key);
    const title = candidate.item_name.trim() || candidate.item_code.trim() || this.dependencies.text('label.item');
    this.update({ selectedKeys, actionMessage: '', scannerStatus: already
      ? this.dependencies.text('production.assignment.already_selected', { count: selectedKeys.size })
      : this.dependencies.text('production.assignment.selected', { title, count: selectedKeys.size }) });
  }
  candidateAction(candidate: Candidate) {
    if (this.state.selectedKeys.size) this.toggleSelection(candidate); else void this.assign(candidate);
  }
  private install(candidate: Candidate, saved: AdminRawMaterialAssignment) {
    const key = sequenceAssignmentBarcodeKey(candidate.barcode), selectedKeys = new Set(this.state.selectedKeys); selectedKeys.delete(key);
    this.update({ candidates: this.state.candidates.filter(row => sequenceAssignmentBarcodeKey(row.barcode) !== key),
      assignments: [saved, ...this.state.assignments.filter(row => sequenceAssignmentBarcodeKey(row.barcode) !== key)], selectedKeys });
  }
  async assign(candidate: Candidate) {
    if (!this.current() || this.busy() || this.state.selectedKeys.size) return;
    const apparatus = this.state.selectedApparatus.trim();
    if (!apparatus || !candidateOptions(candidate).includes(apparatus)) {
      this.update({ actionMessage: this.dependencies.text('production.assignment.apparatus_missing'), actionSucceeded: false }); return;
    }
    this.update({ assigningBarcode: sequenceAssignmentBarcodeKey(candidate.barcode), actionMessage: '' });
    try {
      const saved = await this.dependencies.assign(candidate.barcode.trim(), apparatus);
      if (!this.current()) return;
      this.install(candidate, saved); this.update({ actionMessage: this.dependencies.text('production.assignment.linked'), actionSucceeded: true });
    } catch (error) {
      this.update({ actionMessage: this.message(error, 'production.assignment.failed'), actionSucceeded: false });
      await this.load(false);
    } finally { this.update({ assigningBarcode: '' }); }
  }
  async assignSelected() {
    if (!this.current() || this.busy() || !this.state.selectedKeys.size) return;
    const selected = this.state.candidates.filter(row => this.state.selectedKeys.has(sequenceAssignmentBarcodeKey(row.barcode)));
    if (!selected.length) { this.clearSelection(); return; }
    this.update({ bulkAssigning: true, actionMessage: '' });
    let linkedCount = 0, issue: string | null = null, reload = false;
    try {
      for (const candidate of selected) {
        if (!this.current()) return;
        const apparatus = this.state.selectedApparatus.trim();
        if (!apparatus || !candidateOptions(candidate).includes(apparatus)) { issue = this.dependencies.text('production.assignment.apparatus_missing'); break; }
        try {
          const saved = await this.dependencies.assign(candidate.barcode.trim(), apparatus); if (!this.current()) return;
          this.install(candidate, saved); linkedCount++;
        } catch (error) { issue = this.message(error, 'production.assignment.failed'); reload = true; break; }
      }
      if (!this.current()) return;
      if (reload) { await this.load(false); if (!this.current()) return; }
      if (issue === null) this.update({ bulkAssigning: false, selectedKeys: new Set(), actionSucceeded: true,
        actionMessage: this.dependencies.text('production.assignment.linked_count', { count: linkedCount }),
        ...(this.state.scannerVisible ? { scannerStatus: this.dependencies.text('production.assignment.linked_scan_more', { count: linkedCount }) } : {}) });
      else this.update({ bulkAssigning: false, actionSucceeded: false, actionMessage: linkedCount > 0
        ? this.dependencies.text('production.assignment.partial_linked', { count: linkedCount, error: issue }) : issue });
    } finally { this.update({ bulkAssigning: false }); }
  }
  dispose() { this.disposed = true; this.readGeneration++; this.diagnosticGeneration++; this.listeners.clear(); }
}
