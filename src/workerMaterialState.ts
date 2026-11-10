import { rawMaterialBarcodeFromQr } from './shared/barcode/rawMaterialBarcode';
import type { MaterialLinkOverview, MaterialLinkRequest, MaterialLinkRoll, WorkerMaterialCandidate, WorkerMaterialCandidates } from './workerMaterialLinkApi';

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
type Scope = { current: () => boolean; changed: () => void; enabled?: () => boolean; canRefresh?: () => boolean };

/** @v2 _MaterialLinkRequestPanelState
 * A read started before a write cannot replace the post-write verification.
 * A failed create is verified, never automatically retried.
 */
export class MaterialLinkRequestState {
  overview: MaterialLinkOverview | null = null;
  error = '';
  busy = false;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private queued = false;
  private seen = new Set<string>();
  constructor(private readonly scope: Scope & {
    allowNew: () => boolean; read: () => Promise<MaterialLinkOverview>;
    create: (barcodes: string[]) => Promise<unknown>; cancel: (requestId: string) => Promise<unknown>;
    pick: (rolls: MaterialLinkRoll[]) => Promise<string[] | null>; linked: () => void;
  }) {}
  private current(generation: number) { return this.scope.current() && generation === this.generation; }
  private emit() { if (this.scope.current()) this.scope.changed(); }
  get latest(): MaterialLinkRequest[] {
    const byMover = new Map<string, MaterialLinkRequest>();
    for (const request of this.overview?.requests ?? []) if (!byMover.has(request.moverRef)) byMover.set(request.moverRef, request);
    return [...byMover.values()];
  }
  get hasPending() { return this.latest.some(request => request.status === 'pending'); }
  notify() { this.queued = true; this.drain(); }
  private drain() { if (this.queued && !this.busy && this.scope.current() && this.scope.canRefresh?.() !== false) void this.refresh(); }
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    if (!this.scope.current()) return Promise.resolve();
    if (this.scope.canRefresh?.() === false) { this.queued = true; return Promise.resolve(); }
    this.queued = false;
    const generation = this.generation;
    const pending = this.scope.read().then(overview => {
      if (!this.current(generation)) return;
      let changed = false;
      for (const request of overview.requests) {
        if (['approved', 'stale'].includes(request.status) && !this.seen.has(request.id)) { this.seen.add(request.id); changed = true; }
      }
      this.overview = overview; this.error = ''; this.emit();
      if (changed) this.scope.linked();
    }).catch(error => {
      if (this.current(generation)) { this.error = message(error, 'So‘rov holatini yangilab bo‘lmadi'); this.emit(); }
    }).finally(() => {
      if (this.pending === pending) { this.pending = null; this.drain(); }
    });
    this.pending = pending;
    return pending;
  }
  private begin() { this.generation++; this.pending = null; this.busy = true; this.error = ''; this.emit(); return this.generation; }
  async send() {
    if (this.busy || this.scope.enabled?.() === false || !this.scope.allowNew() || !this.scope.current()) return;
    const generation = this.begin();
    try {
      const overview = await this.scope.read();
      if (!this.current(generation) || this.scope.enabled?.() === false || !this.scope.allowNew()) return;
      this.overview = overview; this.emit();
      if (overview.requests.some(request => request.status === 'pending')) return;
      if (!overview.candidates.length) { this.error = 'Ulash mumkin bo‘lgan rulon qolmagan. Holatni yangilang'; this.emit(); return; }
      const selected = await this.scope.pick(overview.candidates);
      if (!this.current(generation) || this.scope.enabled?.() === false || !this.scope.allowNew() || !selected?.length) return;
      await this.scope.create(selected);
      if (this.current(generation)) await this.refresh();
    } catch (error) {
      if (!this.current(generation)) return;
      await this.refresh();
      if (this.current(generation)) { this.error = message(error, 'So‘rov yuborilmadi. Holatni yangilang'); this.emit(); }
    } finally { if (this.current(generation)) { this.busy = false; this.emit(); this.drain(); } }
  }
  async cancel(request: MaterialLinkRequest) {
    if (this.busy || this.scope.enabled?.() === false || !this.scope.current()) return;
    const generation = this.begin();
    try { await this.scope.cancel(request.id); if (this.current(generation)) await this.refresh(); }
    catch (error) { if (this.current(generation)) { this.error = message(error, 'Aloqa uzildi'); this.emit(); } }
    finally { if (this.current(generation)) { this.busy = false; this.emit(); this.drain(); } }
  }
  dispose() { this.generation++; this.pending = null; this.queued = false; }
}

/** @v2 _WorkerMaterialUsePanelState */
export class WorkerMaterialUseState {
  snapshot: WorkerMaterialCandidates | null = null;
  scannerOpen = false;
  busy = false;
  confirming = false;
  feedback: 'accepted' | 'rejected' | null = null;
  feedbackText = '';
  private generation = 0;
  private pending: Promise<void> | null = null;
  private queued = false;
  constructor(private readonly scope: Scope & {
    read: () => Promise<WorkerMaterialCandidates>; use: (material: WorkerMaterialCandidate) => Promise<void>;
    confirm: (material: WorkerMaterialCandidate) => Promise<boolean>; used: (barcode: string) => void;
    text: (key: string) => string;
  }) {}
  get candidates() { return this.snapshot?.enabled ? this.snapshot.candidates : []; }
  private current(generation: number) { return this.scope.current() && this.generation === generation; }
  private emit() { if (this.scope.current()) this.scope.changed(); }
  notify() { this.queued = true; this.drain(); }
  private drain() { if (this.queued && !this.busy && !this.confirming && this.scope.current() && this.scope.canRefresh?.() !== false) void this.refresh(); }
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    if (!this.scope.current()) return Promise.resolve();
    if (this.scope.canRefresh?.() === false) { this.queued = true; return Promise.resolve(); }
    this.queued = false;
    const generation = this.generation;
    const pending = this.scope.read().then(snapshot => {
      if (this.current(generation)) { this.snapshot = snapshot; this.emit(); }
    }).catch(() => {
      // A failed permission read must not leave a stale eligible candidate.
      if (this.current(generation)) { this.snapshot = null; this.emit(); }
    }).finally(() => { if (this.pending === pending) { this.pending = null; this.drain(); } });
    this.pending = pending;
    return pending;
  }
  async toggleScanner() {
    if (this.busy || this.confirming || this.scope.enabled?.() === false || !this.scope.current()) return;
    await this.refresh();
    if (this.scope.current() && this.scope.enabled?.() !== false && this.candidates.length) { this.scannerOpen = !this.scannerOpen; this.emit(); }
  }
  clearFeedback() { this.feedback = null; this.feedbackText = ''; this.emit(); }
  async scan(raw: string) {
    if (!this.scannerOpen || this.busy || this.confirming || this.scope.enabled?.() === false || !this.scope.current()) return;
    const generation = this.generation;
    const barcode = rawMaterialBarcodeFromQr(raw).trim().toUpperCase();
    const material = this.candidates.find(row => row.barcode.toUpperCase() === barcode);
    if (!material) { this.feedback = 'rejected'; this.feedbackText = this.scope.text('worker.material_use.rejected'); this.emit(); return; }
    this.feedback = 'accepted'; this.feedbackText = this.scope.text('worker.material_use.accepted'); this.confirming = true; this.emit();
    let mutationGeneration = generation;
    try {
      const confirmed = await this.scope.confirm(material);
      if (!confirmed || !this.current(generation) || this.scope.enabled?.() === false) return;
      mutationGeneration = ++this.generation; this.pending = null; this.busy = true; this.emit();
      try {
        await this.scope.use(material);
        if (!this.current(mutationGeneration)) return;
        this.scope.used(material.barcode);
        await this.refresh();
      } catch (error) {
        if (!this.current(mutationGeneration)) return;
        this.feedback = 'rejected'; this.feedbackText = message(error, this.scope.text('worker.material_use.failed')); this.emit();
        await this.refresh();
      }
    } finally {
      if (this.current(mutationGeneration)) { this.busy = false; this.confirming = false; this.emit(); this.drain(); }
    }
  }
  dispose() { this.generation++; this.pending = null; this.queued = false; }
}
