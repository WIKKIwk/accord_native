import { rawSplitBarcode } from './rawSplitBarcode';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import * as api from './rawSplitApi';
import { buildRawSplitPayload, newRawSplitRequestId, rawSplitConfirmWidth, rawSplitOutputNet, RawSplitWasteInputError,
  type RawSplitOutputDraft, type RawSplitOutputField } from './rawSplitDraft';
import { RawSplitRoll, RawSplitResult, RawSplitSnapshot, RawSplitWasteCheck, rawSplitQuantity } from './rawSplitModel';
import { RawSplitWidthPlan } from './rawSplitWidthPlan';
import { rawSplitWriteDispatchAllowed } from './rawSplitWritePolicy';

type Json = Record<string, unknown>;
type Device = PreparationDeviceSelection;
type Operations = Pick<typeof api, 'rawSplitScope' | 'rawSplitSessionIsCurrent' | 'rawSplitPending' | 'rawSplitIssuePending' | 'rawSplitSnapshot' |
  'rawSplitSource' | 'rawSplitSave' | 'rawSplitReportIssue'>;
export type RawSplitControllerState = {
  barcode: string; waste: string; issueNote: string; outputs: RawSplitOutputDraft[]; source: RawSplitRoll | null;
  snapshot: RawSplitSnapshot | null; saved: RawSplitResult | null; pending: Json | null; pendingIssue: Json | null;
  printer: Device | null; wifiPrinter: string; error: string | null; issueError: string | null; snapshotError: string | null;
  showIssue: boolean; issueSaved: boolean; savedIssueId: string | null; busy: boolean;
  pendingCheck: 'unread' | 'checking' | 'ready' | 'failed'; pendingCheckError: string | null;
};
export type RawSplitControllerOptions = {
  ticket: api.RawSplitSessionTicket; canMutate: () => boolean; selectPrinter: (isCurrent: () => boolean) => Promise<Device | null>;
  print: (result: RawSplitResult, printer: Device, wifiPrinter: string, guard: () => void) => Promise<void>;
  onMessage: (message: string) => void; onIssueVisible: () => void;
  printerSupported: (printer: Device, wifiPrinter: string) => boolean; onUnsupportedPrinter: (printer: Device, wifiPrinter: string) => void;
  operations?: Operations; requestId?: () => Promise<string>;
};
let nextOutputKey = 0;
const emptyOutput = (): RawSplitOutputDraft => ({ id: String(++nextOutputKey), width: '', gross: '', bobina: '', length: '' });
const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
const pendingChanged = (reason: unknown) => reason instanceof Error && (reason as Error & { code?: string }).code === 'raw_split_pending_changed';

/** Shared state transitions from V2 _RawMaterialSplitScreenState. */
export class RawSplitController {
  private readonly ops: Operations; private readonly scope: string; private active = true; private pendingGeneration = 0; private snapshotGeneration = 0;
  private readonly listeners = new Set<() => void>();
  private state: RawSplitControllerState = { barcode: '', waste: '', issueNote: '', outputs: [], source: null,
    snapshot: null, saved: null, pending: null, pendingIssue: null, printer: null, wifiPrinter: 'godex',
    error: null, issueError: null, snapshotError: null, showIssue: false, issueSaved: false, savedIssueId: null, busy: false,
    pendingCheck: 'unread', pendingCheckError: null };
  constructor(private readonly options: RawSplitControllerOptions) { this.ops = options.operations ?? api; this.scope = this.ops.rawSplitScope(); }
  getSnapshot = (): RawSplitControllerState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  dispose(): void { this.active = false; this.listeners.clear(); }
  private isCurrent = (): boolean => {
    try { return this.active && this.ops.rawSplitSessionIsCurrent(this.options.ticket) && this.ops.rawSplitScope() === this.scope; }
    catch { return false; }
  };
  private update(patch: Partial<RawSplitControllerState>): void {
    if (!this.isCurrent()) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private checkScope = (): void => {
    if (!this.isCurrent()) throw new Error('Akkaunt o‘zgargan');
  };
  private writeAllowed(): boolean { return isSynchronouslyTrue(this.options.canMutate); }
  private checkPendingLease = (generation: number): void => {
    this.checkScope();
    if (generation !== this.pendingGeneration || this.state.pendingCheck !== 'ready') throw new Error('Natija olinmadi. Qayta tekshiring.');
  };
  private checkWriteScope = (generation: number): void => {
    this.checkPendingLease(generation);
    if (this.writesHeld || !this.writeAllowed()) throw new Error('Sessiya xavfsizligi tasdiqlanmagan');
    this.checkPendingLease(generation);
  };
  /** The production role leaves writes held until a durable, authoritative acknowledgment exists. */
  get writesHeld(): boolean { return !isSynchronouslyTrue(rawSplitWriteDispatchAllowed); }
  get locked(): boolean { return this.state.pendingCheck !== 'ready' || this.state.busy || this.state.pending !== null || this.state.pendingIssue !== null; }
  /** A lease never becomes current again after a recheck, even if the same keys are later empty. */
  captureClearLease = (): (() => boolean) | null => {
    if (!this.isCurrent() || this.locked) return null;
    const generation = this.pendingGeneration;
    return () => this.isCurrent() && generation === this.pendingGeneration && !this.locked;
  };
  get widthPlan(): RawSplitWidthPlan | null {
    return this.state.source ? new RawSplitWidthPlan(this.state.source.widthMm, this.state.outputs.map(output => output.width)) : null;
  }
  get wasteCheck(): RawSplitWasteCheck | null {
    if (!this.state.source) return null;
    try { return new RawSplitWasteCheck(rawSplitQuantity(this.state.source.kg),
      this.state.outputs.reduce((sum, output) => sum + rawSplitOutputNet(output), 0n), this.state.waste); }
    catch { return null; }
  }
  async reload(): Promise<void> { await this.readPending(true); }
  /** Retry only the two local status reads. No command or print is dispatched. */
  async recheckPending(): Promise<void> { await this.readPending(false); }
  private async readPending(withSnapshot: boolean): Promise<void> {
    if (this.state.busy || !this.isCurrent()) return;
    this.pendingGeneration++;
    this.update({ busy: true, pendingCheck: 'checking', pendingCheckError: null });
    let verified = false;
    try {
      // Publish the pair together only after both reads succeed for this exact session.
      const pending = await this.ops.rawSplitPending(this.options.ticket); this.checkScope();
      const pendingIssue = await this.ops.rawSplitIssuePending(this.options.ticket); this.checkScope();
      this.update({ pending, pendingIssue, pendingCheck: 'ready' }); verified = true;
    } catch (reason) { this.update({ pendingCheck: 'failed', pendingCheckError: message(reason) }); }
    if (!verified) {
      // A failed local check must not leave a spinner or prevent a user-initiated retry.
      this.update({ busy: false });
      if (withSnapshot && this.isCurrent()) await this.loadSnapshot();
      return;
    }
    try { if (withSnapshot) await this.loadSnapshot(); }
    finally { this.update({ busy: false }); }
  }
  private async loadSnapshot(): Promise<void> {
    const generation = ++this.snapshotGeneration;
    try { const snapshot = await this.ops.rawSplitSnapshot(this.options.ticket); this.checkScope(); if (generation === this.snapshotGeneration) this.update({ snapshot, snapshotError: null }); }
    catch (reason) { if (generation === this.snapshotGeneration) this.update({ snapshotError: message(reason) }); }
  }
  setBarcode(barcode: string): void { if (!this.locked) this.update({ barcode }); }
  setWaste(waste: string): void { if (!this.locked) this.update({ waste, issueSaved: false, issueError: null }); }
  setIssueNote(issueNote: string): void { if (!this.locked && !this.state.issueSaved) this.update({ issueNote }); }
  setWifiPrinter(wifiPrinter: string): void { if (!this.state.busy && this.state.pendingCheck === 'ready') this.update({ wifiPrinter }); }
  setOutput(index: number, field: RawSplitOutputField, value: string): void {
    if (this.locked || !this.state.outputs[index]) return;
    const outputs = this.state.outputs.map((output, i) => i === index ? { ...output, [field]: value } : output);
    this.update({ outputs, issueSaved: false, issueError: null });
  }
  confirmWidth(): void {
    if (this.locked || !this.state.source) return;
    this.update({ error: null, outputs: rawSplitConfirmWidth(this.state.source.widthMm, this.state.outputs) });
  }
  addRoll(): void {
    if (this.locked || !this.state.source || !this.widthPlan?.canAdd) return;
    this.update({ error: null, issueSaved: false, outputs: [...this.state.outputs, emptyOutput()] });
  }
  removeRoll(index: number): void {
    if (this.locked || this.state.outputs.length <= 1 || !this.state.outputs[index]) return;
    this.update({ outputs: this.state.outputs.filter((_, i) => i !== index), issueSaved: false });
  }
  async lookup(raw = this.state.barcode): Promise<void> {
    if (this.locked || !this.isCurrent()) return;
    const barcode = rawSplitBarcode(raw); if (!barcode) return;
    this.pendingGeneration++;
    this.update({ barcode: raw, busy: true, error: null, source: null, saved: null });
    try {
      const source = await this.ops.rawSplitSource(this.options.ticket, barcode); this.checkScope();
      this.update({ source, outputs: [emptyOutput()], waste: '', issueNote: '', showIssue: false, issueSaved: false,
        savedIssueId: null, issueError: null });
    } catch (reason) { this.update({ error: message(reason) }); }
    finally { this.update({ busy: false }); }
  }
  private async choosePrinter(generation: number): Promise<boolean> {
    if (this.writesHeld || !this.isCurrent() || this.state.pendingCheck !== 'ready' || generation !== this.pendingGeneration) return false;
    const current = () => !this.writesHeld && this.isCurrent() && this.state.pendingCheck === 'ready' && generation === this.pendingGeneration;
    const selected = await this.options.selectPrinter(current);
    if (this.writesHeld || !this.isCurrent() || this.state.pendingCheck !== 'ready' || generation !== this.pendingGeneration || selected === null) return false;
    this.update({ printer: selected }); return true;
  }
  async selectPrinter(): Promise<boolean> {
    if (this.writesHeld || this.state.busy || this.state.pendingCheck !== 'ready') return false;
    return this.choosePrinter(this.pendingGeneration);
  }
  private async payload(issue: boolean): Promise<Json> {
    const source = this.state.source;
    if (!source) throw new TypeError();
    const requestId = await (this.options.requestId ?? newRawSplitRequestId)();
    return buildRawSplitPayload({ source, outputs: this.state.outputs, waste: this.state.waste, issue,
      issueSaved: this.state.issueSaved, savedIssueId: this.state.savedIssueId, requestId });
  }
  async save(retry = false): Promise<void> {
    if (this.writesHeld || !this.isCurrent() || this.state.pendingCheck !== 'ready' || this.state.busy || (!retry && this.locked)) return;
    const generation = ++this.pendingGeneration, guard = () => this.checkWriteScope(generation);
    this.update({ busy: true, error: null });
    let retryFailure: string | null = null;
    try {
      const payload = retry ? this.state.pending : await this.payload(false);
      if (!payload) return;
      guard();
      if (!this.state.printer && !await this.choosePrinter(generation)) return;
      if (!this.options.printerSupported(this.state.printer!, this.state.wifiPrinter)) { this.options.onUnsupportedPrinter(this.state.printer!, this.state.wifiPrinter); return; }
      guard();
      const result = await this.ops.rawSplitSave(this.options.ticket, payload, guard, retry);
      this.checkPendingLease(generation);
      this.update({ saved: result, source: null, pending: null, barcode: '' });
      await this.options.print(result, this.state.printer!, this.state.wifiPrinter, guard);
      guard(); this.options.onMessage('Chop etildi');
    } catch (reason) {
      if (pendingChanged(reason)) retryFailure = message(reason);
      else if (reason instanceof RawSplitWasteInputError) { this.update({ showIssue: true }); if (this.isCurrent()) this.options.onIssueVisible(); }
      else this.update({ error: this.state.saved ? `Omborga saqlandi. Chop etish: ${message(reason)}` : message(reason) });
    } finally {
      if (this.isCurrent()) {
        this.pendingGeneration++;
        if (retryFailure !== null) this.update({ busy: false, pendingCheck: 'failed', pendingCheckError: retryFailure });
        else { this.update({ busy: false, pendingCheck: 'unread' }); await this.reload(); }
      }
    }
  }
  async saveIssue(retry = false): Promise<void> {
    if (this.writesHeld || !this.isCurrent() || this.state.pendingCheck !== 'ready' || this.state.busy || (!retry && (this.locked || this.state.issueSaved))) return;
    const generation = ++this.pendingGeneration, guard = () => this.checkWriteScope(generation);
    this.update({ busy: true, issueError: null, error: null });
    let retryFailure: string | null = null;
    try {
      if (!retry && !this.state.issueNote.trim()) throw new Error('Farq sababini yozing');
      const payload = retry ? this.state.pendingIssue : { command: await this.payload(true), note: this.state.issueNote.trim() };
      if (!payload) return;
      guard();
      const issue = await this.ops.rawSplitReportIssue(this.options.ticket, payload, guard, retry);
      this.checkPendingLease(generation);
      this.update({ pendingIssue: null, issueSaved: true, savedIssueId: issue.id });
      if (!this.state.source && this.isCurrent()) this.options.onMessage('Muammo saqlandi');
    } catch (reason) { if (pendingChanged(reason)) retryFailure = message(reason); else this.update({ issueError: message(reason) }); }
    finally { if (this.isCurrent()) {
      this.pendingGeneration++;
      if (retryFailure !== null) this.update({ busy: false, pendingCheck: 'failed', pendingCheckError: retryFailure });
      else { this.update({ busy: false, pendingCheck: 'unread' }); await this.reload(); }
    } }
  }
}
