import type { AdminApparatus } from '../apparatusApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminProgressQrMaterialReport, AdminProgressQrOpeningWipReport, AdminProgressQrPaddonReport } from './adminProgressQrFallbackModel';
import { adminProgressQrNeedsWorkerQueue } from './adminProgressQrFallbackModel';
import { adminProgressQrFallbackFailed, adminProgressQrFallbackState } from './adminProgressQrFallbackPolicy';
import { adminProgressQrLookupFailureKind, adminProgressQrLookupInitial, adminProgressQrLookupVisibleReport, type AdminProgressQrLookupState } from './adminProgressQrLookupModel';
import type { AdminProgressQrReport } from './adminProgressQrReportModel';
import type { AdminUserPrincipalRole } from './adminUsersModel';
import { dartTrim } from './dartJsonString';

type Guard = () => void;
type Read<T> = (normalizedPayload: string, guard: Guard, witness: () => boolean) => Promise<T>;
export type AdminProgressQrLookupScanner = Readonly<{
  stop: (guard: Guard) => Promise<void>; retry: (guard: Guard) => Promise<boolean>;
  phase: () => 'idle' | 'starting' | 'recovering' | 'running' | 'stopping' | 'suspended' | 'error' | 'disposed';
}>;
export type AdminProgressQrLookupDependencies = Readonly<{
  isCurrent: () => boolean; canInteract: () => boolean; scanner: AdminProgressQrLookupScanner | null;
  primary: Read<AdminProgressQrReport>; paddon: Read<AdminProgressQrPaddonReport>; opening: Read<AdminProgressQrOpeningWipReport>; material: Read<AdminProgressQrMaterialReport>;
  apparatus: (guard: Guard, witness: () => boolean) => Promise<readonly AdminApparatus[]>;
  returnScan: (normalizedPayload: string, guard: Guard) => void;
  replaceWorkerQueue: (normalizedPayload: string, guard: Guard) => void;
}>;
export type AdminProgressQrManualTicket = Readonly<{ generation: number }>;
/** Source-normalized input owner. Native camera/coordinator, Dart URI extraction and actual modal/navigation completion remain genuine required adapters. */
export class AdminProgressQrLookupController {
  private state = adminProgressQrLookupInitial(); private active = false; private retired = false; private checking = false; private generation = 0;
  private interactionFrame: { reentered: boolean } | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly manual = new WeakMap<AdminProgressQrManualTicket, number>();
  constructor(private readonly deps: AdminProgressQrLookupDependencies, readonly scanOnly: boolean, readonly principalRole: AdminUserPrincipalRole) {}
  get interactionGeneration() { return this.generation; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private replace(state: AdminProgressQrLookupState): void {
    this.state = state; for (const listener of [...this.listeners]) { try { listener(); } catch { /* Render observers cannot turn a report into an API fallback failure. */ } }
  }
  private publish(patch: Partial<AdminProgressQrLookupState>): void { this.replace(Object.freeze({ ...this.state, ...patch })); }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.invalidate(); return false; } this.checking = true;
    const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.invalidate(); return false; }
    return this.active && !this.retired && generation === this.generation;
  };
  canInteract = (generation = this.generation): boolean => {
    if (!this.isCurrent(generation)) return false;
    if (this.interactionFrame) { this.interactionFrame.reentered = true; return false; }
    const frame = { reentered: false }; this.interactionFrame = frame; let allowed: boolean;
    try { allowed = isSynchronouslyTrue(this.deps.canInteract); } finally { this.interactionFrame = null; }
    return this.isCurrent(generation) && allowed && !frame.reentered;
  };
  private guard(generation: number): Guard { return () => { if (!this.isCurrent(generation)) throw new Error('Original QR lookup owner changed'); }; }
  start(): void {
    if (this.active || this.retired) return; this.active = true; this.generation++;
    if (!this.isCurrent()) return;
    if (!this.scanOnly) void this.loadApparatus(this.generation);
  }
  private async loadApparatus(generation: number): Promise<void> {
    const guard = this.guard(generation); let settled = false;
    const original = () => { guard(); if (settled) throw new Error('QR apparatus read settled'); }, witness = () => { original(); return true; };
    try { original(); const apparatus = await this.deps.apparatus(original, witness); original(); this.publish({ apparatus: Object.freeze([...apparatus]) }); }
    catch { /* Source display catalog failure leaves canonical apparatus IDs visible. */ } finally { settled = true; }
  }
  /** Only a genuinely mounted scanner's parsed detection enters here; this does not parse URL/raw barcodes. */
  async detectNormalized(value: string, generation = this.generation): Promise<void> {
    if (!this.canInteract(generation) || this.state.processing || adminProgressQrLookupVisibleReport(this.state) !== null) return;
    return this.handleNormalized(value, generation);
  }
  /** Source live-scanner manual button is disabled while processing; unsupported-scanner button has no such condition. */
  issueManual(generation = this.generation): AdminProgressQrManualTicket | null {
    if (!this.canInteract(generation) || adminProgressQrLookupVisibleReport(this.state) !== null || (this.deps.scanner !== null && this.state.processing)) return null;
    const ticket = Object.freeze({ generation }); this.manual.set(ticket, generation); return ticket;
  }
  /** Call only after the genuine dialog's native removal acknowledges its selected, Source-normalized result. Expected modal blur is not read retirement. */
  async completeManual(ticket: AdminProgressQrManualTicket, normalizedValue: string | null): Promise<void> {
    const generation = this.manual.get(ticket); this.manual.delete(ticket);
    if (generation === undefined || !this.isCurrent(generation) || normalizedValue === null) return;
    return this.handleNormalized(normalizedValue, generation);
  }
  private async stopScanner(guard: Guard): Promise<void> {
    if (this.deps.scanner === null) return; guard(); await this.deps.scanner.stop(guard); guard();
  }
  private async startScanner(generation: number, preserveLookupError: boolean): Promise<void> {
    if (!this.isCurrent(generation) || this.deps.scanner === null) return;
    const guard = this.guard(generation); let started: boolean;
    try { guard(); started = await this.deps.scanner.retry(guard); }
    catch (error) { if (!this.isCurrent(generation)) return; throw error; }
    if (!this.isCurrent(generation)) return;
    const failed = !started && this.deps.scanner.phase() === 'error'; guard();
    this.publish({ processing: false, ...(failed ? { status: 'cameraFailed' as const } : preserveLookupError ? {} : { status: 'prompt' as const, scanError: null }) });
  }
  async retryScanner(generation = this.generation): Promise<void> { if (this.canInteract(generation)) return this.startScanner(generation, false); }
  async scanAgain(generation = this.generation): Promise<void> {
    if (!this.canInteract(generation)) return;
    this.publish({ report: null, paddonReport: null, rawMaterialReport: null, openingWipReport: null, scanError: null, status: 'prompt' });
    // Source does not reset processing before the asynchronous retry settles.
    return this.startScanner(generation, false);
  }
  private async handleNormalized(value: string, generation: number): Promise<void> {
    const normalized = dartTrim(value); if (!this.isCurrent(generation)) return;
    if (!normalized) { this.publish({ status: 'invalidQr' }); return; }
    const guard = this.guard(generation);
    if (this.scanOnly) {
      this.publish({ processing: true });
      try { guard(); await this.stopScanner(guard); }
      catch (error) { if (!this.isCurrent(generation)) return; throw error; }
      if (!this.isCurrent(generation)) return; this.deps.returnScan(normalized, guard); return;
    }
    if (this.state.processing) return;
    this.publish({ processing: true, status: 'loading', scanError: null });
    if (!this.isCurrent(generation)) return;
    // Intentionally outside Source lookup try/catch: a stop rejection leaves loading/processing as-is.
    try { await this.stopScanner(guard); }
    catch (error) { if (!this.isCurrent(generation)) return; throw error; }
    if (!this.isCurrent(generation)) return;
    let settled = false;
    const original = () => { guard(); if (settled) throw new Error('QR lookup read settled'); }, witness = () => { original(); return true; };
    const replaceQueue = (kind: 'progress' | 'opening-wip'): boolean => {
      original(); if (!adminProgressQrNeedsWorkerQueue(this.principalRole, kind)) return false;
      this.deps.replaceWorkerQueue(normalized, guard); return true;
    };
    try {
      try {
        original(); const report = await this.deps.primary(normalized, original, witness); original();
        if (replaceQueue('progress')) return;
        this.publish({ report, processing: false, status: 'reportReady' });
      } catch (primaryError) {
        if (!this.isCurrent(generation)) return;
        let fallback = adminProgressQrFallbackState(normalized, primaryError);
        const failed = (error: unknown) => { fallback = adminProgressQrFallbackFailed(fallback, error, adminProgressQrLookupFailureKind(error)); };
        if (fallback.tryPaddon) {
          try { original(); const paddonReport = await this.deps.paddon(normalized, original, witness); original(); this.publish({ paddonReport, processing: false, status: 'paddonReady' }); return; }
          catch (error) { if (!this.isCurrent(generation)) return; failed(error); }
        }
        if (fallback.tryOpeningWip) {
          try {
            original(); const openingWipReport = await this.deps.opening(normalized, original, witness); original();
            if (replaceQueue('opening-wip')) return;
            this.publish({ openingWipReport, processing: false, status: 'openingWipReady' }); return;
          } catch (error) { if (!this.isCurrent(generation)) return; failed(error); }
        }
        if (fallback.tryMaterial) {
          try { original(); const rawMaterialReport = await this.deps.material(normalized, original, witness); original(); this.publish({ rawMaterialReport, processing: false, status: 'materialReady' }); return; }
          catch (error) { if (!this.isCurrent(generation)) return; failed(error); }
        }
        original(); this.publish({ processing: false, status: 'error', scanError: fallback.lookupError }); original();
        await this.startScanner(generation, true);
      }
    } finally { settled = true; }
  }
  invalidate(): void { if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.replace(adminProgressQrLookupInitial(false)); }
  /** React effect replay may attach the retained owner again; native scanner lifetime remains owned by the real scanner/coordinator adapter. */
  detach(): void { this.active = false; this.generation++; this.replace(adminProgressQrLookupInitial(!this.retired)); }
}
