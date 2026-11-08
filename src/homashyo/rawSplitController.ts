import { rawSplitBarcode } from './rawSplitBarcode';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import * as api from './rawSplitApi';
import { buildRawSplitPayload, newRawSplitRequestId, rawSplitConfirmWidth, rawSplitOutputNet, RawSplitWasteInputError,
  type RawSplitOutputDraft, type RawSplitOutputField } from './rawSplitDraft';
import { RawSplitRoll, RawSplitResult, RawSplitSnapshot, RawSplitWasteCheck, rawSplitQuantity } from './rawSplitModel';
import { RawSplitWidthPlan } from './rawSplitWidthPlan';

type Json = Record<string, unknown>;
type Device = PreparationDeviceSelection;
type Operations = Pick<typeof api, 'rawSplitScope' | 'rawSplitSessionIsCurrent' | 'rawSplitPending' | 'rawSplitIssuePending' | 'rawSplitSnapshot' |
  'rawSplitSource' | 'rawSplitSave' | 'rawSplitReportIssue'>;
export type RawSplitControllerState = {
  barcode: string; waste: string; issueNote: string; outputs: RawSplitOutputDraft[]; source: RawSplitRoll | null;
  snapshot: RawSplitSnapshot | null; saved: RawSplitResult | null; pending: Json | null; pendingIssue: Json | null;
  printer: Device | null; wifiPrinter: string; error: string | null; issueError: string | null;
  showIssue: boolean; issueSaved: boolean; savedIssueId: string | null; busy: boolean;
};
export type RawSplitControllerOptions = {
  ticket: api.RawSplitSessionTicket; selectPrinter: () => Promise<Device | null>;
  print: (result: RawSplitResult, printer: Device, wifiPrinter: string, guard: () => void) => Promise<void>;
  onMessage: (message: string) => void; onIssueVisible: () => void;
  printerSupported: (printer: Device, wifiPrinter: string) => boolean; onUnsupportedPrinter: () => void;
  operations?: Operations; requestId?: () => Promise<string>;
};
let nextOutputKey = 0;
const emptyOutput = (): RawSplitOutputDraft => ({ id: String(++nextOutputKey), width: '', gross: '', bobina: '', length: '' });
const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);

/** Shared state transitions from V2 _RawMaterialSplitScreenState. */
export class RawSplitController {
  private readonly ops: Operations; private readonly scope: string; private active = true;
  private readonly listeners = new Set<() => void>();
  private state: RawSplitControllerState = { barcode: '', waste: '', issueNote: '', outputs: [], source: null,
    snapshot: null, saved: null, pending: null, pendingIssue: null, printer: null, wifiPrinter: 'godex',
    error: null, issueError: null, showIssue: false, issueSaved: false, savedIssueId: null, busy: false };
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
  get locked(): boolean { return this.state.busy || this.state.pending !== null || this.state.pendingIssue !== null; }
  get widthPlan(): RawSplitWidthPlan | null {
    return this.state.source ? new RawSplitWidthPlan(this.state.source.widthMm, this.state.outputs.map(output => output.width)) : null;
  }
  get wasteCheck(): RawSplitWasteCheck | null {
    if (!this.state.source) return null;
    try { return new RawSplitWasteCheck(rawSplitQuantity(this.state.source.kg),
      this.state.outputs.reduce((sum, output) => sum + rawSplitOutputNet(output), 0n), this.state.waste); }
    catch { return null; }
  }
  async reload(): Promise<void> {
    if (this.state.busy || !this.isCurrent()) return;
    this.update({ busy: true });
    try {
      const pending = await this.ops.rawSplitPending(this.options.ticket); this.checkScope(); this.update({ pending });
      const pendingIssue = await this.ops.rawSplitIssuePending(this.options.ticket); this.checkScope(); this.update({ pendingIssue });
      const snapshot = await this.ops.rawSplitSnapshot(this.options.ticket); this.checkScope(); this.update({ snapshot });
    } catch (reason) { this.update({ error: message(reason) }); }
    finally { this.update({ busy: false }); }
  }
  setBarcode(barcode: string): void { if (!this.locked) this.update({ barcode }); }
  setWaste(waste: string): void { if (!this.locked) this.update({ waste, issueSaved: false, issueError: null }); }
  setIssueNote(issueNote: string): void { if (!this.locked && !this.state.issueSaved) this.update({ issueNote }); }
  setWifiPrinter(wifiPrinter: string): void { if (!this.state.busy) this.update({ wifiPrinter }); }
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
    this.update({ barcode: raw, busy: true, error: null, source: null, saved: null });
    try {
      const source = await this.ops.rawSplitSource(this.options.ticket, barcode); this.checkScope();
      this.update({ source, outputs: [emptyOutput()], waste: '', issueNote: '', showIssue: false, issueSaved: false,
        savedIssueId: null, issueError: null });
    } catch (reason) { this.update({ error: message(reason) }); }
    finally { this.update({ busy: false }); }
  }
  async selectPrinter(): Promise<boolean> {
    if (!this.isCurrent()) return false;
    const selected = await this.options.selectPrinter();
    if (!this.isCurrent() || selected === null) return false;
    this.update({ printer: selected }); return true;
  }
  private async payload(issue: boolean): Promise<Json> {
    const source = this.state.source;
    if (!source) throw new TypeError();
    const requestId = await (this.options.requestId ?? newRawSplitRequestId)();
    return buildRawSplitPayload({ source, outputs: this.state.outputs, waste: this.state.waste, issue,
      issueSaved: this.state.issueSaved, savedIssueId: this.state.savedIssueId, requestId });
  }
  async save(retry = false): Promise<void> {
    if (!this.isCurrent() || this.state.busy || (!retry && this.locked)) return;
    this.update({ busy: true, error: null });
    try {
      const payload = retry ? this.state.pending : await this.payload(false);
      if (!payload) return;
      if (!this.state.printer && !await this.selectPrinter()) return;
      if (!this.options.printerSupported(this.state.printer!, this.state.wifiPrinter)) { this.options.onUnsupportedPrinter(); return; }
      this.checkScope();
      const result = await this.ops.rawSplitSave(this.options.ticket, payload); this.checkScope();
      this.update({ saved: result, source: null, pending: null, barcode: '' });
      await this.options.print(result, this.state.printer!, this.state.wifiPrinter, this.checkScope);
      if (this.isCurrent()) this.options.onMessage('Chop etildi');
    } catch (reason) {
      if (reason instanceof RawSplitWasteInputError) { this.update({ showIssue: true }); if (this.isCurrent()) this.options.onIssueVisible(); }
      else this.update({ error: this.state.saved ? `Omborga saqlandi. Chop etish: ${message(reason)}` : message(reason) });
    } finally {
      if (this.isCurrent()) { this.update({ busy: false }); await this.reload(); }
    }
  }
  async saveIssue(retry = false): Promise<void> {
    if (!this.isCurrent() || this.state.busy || (!retry && (this.locked || this.state.issueSaved))) return;
    this.update({ busy: true, issueError: null, error: null });
    try {
      if (!retry && !this.state.issueNote.trim()) throw new Error('Farq sababini yozing');
      const payload = retry ? this.state.pendingIssue : { command: await this.payload(true), note: this.state.issueNote.trim() };
      if (!payload) return;
      const issue = await this.ops.rawSplitReportIssue(this.options.ticket, payload); this.checkScope();
      this.update({ pendingIssue: null, issueSaved: true, savedIssueId: issue.id });
      if (!this.state.source && this.isCurrent()) this.options.onMessage('Muammo saqlandi');
    } catch (reason) { this.update({ issueError: message(reason) }); }
    finally { if (this.isCurrent()) { this.update({ busy: false }); await this.reload(); } }
  }
}
