import { rawMaterialBarcodeFromQr } from './shared/barcode/rawMaterialBarcode';
import { WorkerPaddonError, WorkerPaddonState, workerPaddonItems, workerPaddonMovable, type WorkerPaddonBatch, type WorkerPaddonSnapshot } from './workerPaddonModel';

type State = { phase: 'loading' | 'ready' | 'error'; snapshot: WorkerPaddonSnapshot | null; busy: boolean; printing: boolean; error: unknown;
  mode: 'add' | 'remove' | null; bobina: number | null; selected: string[]; scanning: boolean; scanned: WorkerPaddonBatch[];
  pending: number; review: boolean; feedback: string; feedbackKind: 'accepted' | 'rejected' | 'none' | null };
type Dependencies = { code: string; current(): boolean; read(current: () => boolean): Promise<WorkerPaddonSnapshot>;
  add(ids: string[], current: () => boolean): Promise<WorkerPaddonSnapshot>;
  remove(ids: string[], single: boolean, current: () => boolean): Promise<WorkerPaddonSnapshot>;
  lookup(qr: string, current: () => boolean): Promise<WorkerPaddonBatch>;
  unlock(current: () => boolean): Promise<WorkerPaddonSnapshot>; changed(): void };

/** @v2 _AparatchiPaddonDetailScreenState */
export class WorkerPaddonDetail extends WorkerPaddonState<State> {
  private queue: Promise<void> = Promise.resolve();
  private readGeneration = 0;
  private scanGeneration = 0;
  private queued = new Set<string>();
  private known = new Map<string, string>();
  constructor(private deps: Dependencies) {
    super({ phase: 'loading', snapshot: null, busy: false, printing: false, error: null, mode: null, bobina: null, selected: [], scanning: false,
      scanned: [], pending: 0, review: false, feedback: '', feedbackKind: null }, deps.current);
  }
  private snapshot(value: WorkerPaddonSnapshot) {
    if (value.paddon.code.trim() !== this.deps.code.trim()) throw new Error('paddon_not_found'); return value;
  }
  async load() {
    if (!this.current() || this.state.busy) return;
    this.revision++; const revisionCurrent = this.capture(), generation = ++this.readGeneration;
    const current = () => revisionCurrent() && generation === this.readGeneration;
    this.update({ phase: this.state.phase === 'ready' && this.state.snapshot ? 'ready' : 'loading', error: null, bobina: null, selected: [] });
    try { const snapshot = this.snapshot(await this.deps.read(current)); this.check(current); this.update({ phase: 'ready', snapshot }); }
    catch (error) { if (current()) this.update({ phase: 'error', error }); }
  }
  items() { return this.state.snapshot ? workerPaddonItems(this.state.snapshot, this.state.mode, this.state.bobina) : []; }
  setPrinting(printing: boolean) { this.update({ printing }); }
  clearError() { this.update({ error: null }); }
  filter(bobina: number) { if (this.current() && !this.state.busy && !this.state.printing) this.update({ bobina: this.state.bobina === bobina ? null : bobina, selected: [] }); }
  edit(mode: 'add' | 'remove') {
    if (!this.current() || this.state.busy || this.state.printing || this.state.scanning || !this.state.snapshot?.can_manage_items) return;
    if (this.state.mode !== mode) this.update({ mode, bobina: null, selected: [] });
  }
  exitSelection() { if (this.current() && !this.state.busy) this.update({ mode: null, bobina: null, selected: [] }); }
  toggle(id: string) {
    if (!this.current() || this.state.busy || this.state.printing || !this.state.mode || !this.state.snapshot?.can_manage_items) return;
    const row = this.items().find(item => item.batch_id === id); if (!row) return;
    const selected = this.state.selected;
    if (this.state.mode === 'add' && !selected.includes(id) && this.state.snapshot.available_items.some(item => selected.includes(item.batch_id) &&
        (item.wip_status === 'peremotka') !== (row.wip_status === 'peremotka'))) { this.update({ error: new WorkerPaddonError('paddon_roll_kind_conflict') }); return; }
    this.update({ selected: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] });
  }
  private async mutate(command: (current: () => boolean) => Promise<WorkerPaddonSnapshot>, applied: (snapshot: WorkerPaddonSnapshot) => boolean,
    permit: () => boolean, allowLocked = false): Promise<boolean> {
    if (!permit() || this.state.busy || this.state.printing || !this.state.snapshot || (!allowLocked && !this.state.snapshot.can_manage_items)) return false;
    this.update({ busy: true, error: null });
    try {
      const snapshot = this.snapshot(await command(permit)); this.check(permit);
      this.readGeneration++; this.update({ snapshot, phase: 'ready', bobina: null }); this.deps.changed(); return true;
    } catch (error) {
      if (!permit()) return false;
      // The write may have committed. Reconcile once; never resend it here.
      try { const snapshot = this.snapshot(await this.deps.read(permit)); this.check(permit);
        this.readGeneration++; this.update({ snapshot, phase: 'ready', bobina: null });
        if (applied(snapshot)) { this.deps.changed(); return true; }
      } catch { /* Retain the original command error. */ }
      if (permit()) this.update({ error }); return false;
    } finally { if (permit()) this.update({ busy: false }); }
  }
  async add(ids: string[], permit = this.capture()) {
    if (!ids.length || ids.some(id => !this.state.snapshot?.available_items.some(row => row.batch_id === id))) return false;
    const ok = await this.mutate(current => this.deps.add(ids, current), snapshot => ids.every(id => snapshot.items.some(row => row.batch_id === id)), permit);
    if (ok) this.exitSelection(); return ok;
  }
  async remove(ids: string[], single = false, permit = this.capture()) {
    if (!ids.length || ids.some(id => !this.state.snapshot?.items.some(row => row.batch_id === id))) return false;
    const ok = await this.mutate(current => this.deps.remove(ids, single, current), snapshot => ids.every(id => !snapshot.items.some(row => row.batch_id === id)), permit);
    if (ok) this.exitSelection(); return ok;
  }
  async unlock(permit = this.capture()) {
    if (!this.state.snapshot?.can_unlock) return false;
    return this.mutate(this.deps.unlock, snapshot => snapshot.paddon.locked_at_unix == null, permit, true);
  }
  startScan() {
    if (!this.current() || this.state.busy || this.state.printing || !this.state.snapshot?.can_manage_items) return;
    this.scanGeneration++; this.update({ scanning: true, mode: null, bobina: null, selected: [], feedback: '', feedbackKind: null });
  }
  setReview(review: boolean) { if (this.current() && !this.state.busy) this.update({ review }); }
  unstage(id: string) { if (this.current() && this.state.review && !this.state.busy) {
    this.update({ scanned: this.state.scanned.filter(row => row.batch_id !== id) }); for (const [key, value] of this.known) if (value === id) this.known.delete(key);
  } }
  clearFeedback() { this.update({ feedbackKind: null }); }
  private feedback(feedback: string, feedbackKind: State['feedbackKind']) { this.update({ feedback, feedbackKind }); }
  async stage(raw: string) {
    if (!this.current() || !this.state.scanning || this.state.review || this.state.busy || this.state.printing) return;
    const qr = rawMaterialBarcodeFromQr(raw).trim(), key = qr.toUpperCase();
    if (!qr || this.queued.has(key)) return;
    if (this.known.has(key)) { this.feedback('worker.paddon.scan.duplicate', 'none'); return; }
    if (this.state.scanned.length + this.state.pending >= 500) { this.feedback('worker.paddon.scan.limit', 'rejected'); return; }
    const generation = this.scanGeneration, current = () => this.current() && this.state.scanning && generation === this.scanGeneration;
    this.queued.add(key); this.update({ pending: this.state.pending + 1 });
    const operation = this.queue.then(async () => {
      try {
        this.check(current); const batch = await this.deps.lookup(qr, current); this.check(current);
        if (!this.state.snapshot?.can_manage_items) throw new WorkerPaddonError('paddon_locked');
        if (!batch.batch_id.trim() || !batch.qr_payload.trim()) throw new WorkerPaddonError('progress_qr_invalid_response');
        if (this.state.snapshot.items.some(row => row.batch_id === batch.batch_id)) { this.feedback('worker.paddon.scan.already_assigned', 'none'); return; }
        if (this.state.scanned.some(row => row.batch_id === batch.batch_id)) { this.feedback('worker.paddon.scan.duplicate', 'none'); return; }
        if (!workerPaddonMovable(batch)) throw new WorkerPaddonError('progress_batch_not_accepted');
        this.known.set(key, batch.batch_id); this.update({ scanned: [...this.state.scanned, batch] }); this.feedback('worker.paddon.scan.accepted', 'accepted');
      } catch (error) { if (current()) { this.update({ error }); this.feedback('worker.paddon.scan.lookup_failed', 'rejected'); } }
      finally { if (current()) { this.queued.delete(key); this.update({ pending: this.state.pending - 1 }); } }
    });
    this.queue = operation; await operation;
  }
  cancelScan() {
    if (!this.current() || this.state.busy) return;
    this.scanGeneration++; this.queue = Promise.resolve(); this.queued.clear(); this.known.clear();
    this.update({ scanning: false, scanned: [], pending: 0, review: false, feedback: '', feedbackKind: null });
  }
  async confirmScan(permit = this.capture()) {
    const ids = this.state.scanned.map(row => row.batch_id);
    if (!this.state.scanning || this.state.pending || !ids.length) return false;
    const ok = await this.mutate(current => this.deps.add(ids, current), snapshot => ids.every(id => snapshot.items.some(row => row.batch_id === id)), permit);
    if (ok) this.cancelScan(); else if (permit()) this.feedback('worker.paddon.add_failed', 'rejected'); return ok;
  }
}
