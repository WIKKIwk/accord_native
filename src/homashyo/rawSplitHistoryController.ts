import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { rawSplitScope, rawSplitSessionIsCurrent, rawSplitSnapshot, type RawSplitSessionTicket } from './rawSplitApi';
import type { RawSplitResult, RawSplitRoll, RawSplitSnapshot } from './rawSplitModel';

type Device = PreparationDeviceSelection;
export type RawSplitHistoryState = { snapshot: RawSplitSnapshot | null; printer: Device | null; wifiPrinter: string;
  error: string | null; busy: boolean };
export type RawSplitHistoryOptions = { ticket: RawSplitSessionTicket; canMutate: () => boolean; selectPrinter: () => Promise<Device | null>;
  printOne: (result: RawSplitResult, output: RawSplitRoll, printer: Device, wifiPrinter: string, guard: () => void) => Promise<void>;
  onMessage: (message: string) => void; printerSupported: (printer: Device, wifiPrinter: string) => boolean;
  onUnsupportedPrinter: (printer: Device, wifiPrinter: string) => void; snapshot?: typeof rawSplitSnapshot; scope?: () => string };
const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);

/** State transitions from V2 _RawMaterialSplitHistoryScreenState. */
export class RawSplitHistoryController {
  private active = true;
  private listeners = new Set<() => void>();
  private readonly scope: string; private readonly scopeNow: () => string; private readonly sessionCurrent: () => boolean;
  private state: RawSplitHistoryState = { snapshot: null, printer: null, wifiPrinter: 'godex', error: null, busy: false };
  constructor(private readonly options: RawSplitHistoryOptions) {
    this.scopeNow = options.scope ?? rawSplitScope; this.scope = this.scopeNow();
    this.sessionCurrent = () => rawSplitSessionIsCurrent(options.ticket);
  }
  private isCurrent = (): boolean => {
    try { return this.active && this.sessionCurrent() && this.scopeNow() === this.scope; } catch { return false; }
  };
  private checkScope = (): void => { if (!this.isCurrent()) throw new Error('Akkaunt o‘zgargan'); };
  private writeAllowed(): boolean { return isSynchronouslyTrue(this.options.canMutate); }
  private checkWriteScope = (): void => {
    this.checkScope();
    if (!this.writeAllowed()) throw new Error('Sessiya xavfsizligi tasdiqlanmagan');
    this.checkScope();
  };
  getSnapshot = (): RawSplitHistoryState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  dispose(): void { this.active = false; this.listeners.clear(); }
  private update(patch: Partial<RawSplitHistoryState>): void {
    if (!this.isCurrent()) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  async reload(): Promise<void> {
    if (!this.isCurrent() || this.state.busy) return;
    this.update({ busy: true, error: null });
    try { const snapshot = await (this.options.snapshot ?? rawSplitSnapshot)(this.options.ticket); this.checkScope(); this.update({ snapshot }); }
    catch (reason) { this.update({ error: message(reason) }); }
    finally { this.update({ busy: false }); }
  }
  async selectPrinter(): Promise<void> {
    if (!this.isCurrent()) return;
    const printer = await this.options.selectPrinter();
    if (this.isCurrent() && printer !== null) this.update({ printer });
  }
  setWifiPrinter(value: string): void { if (!this.state.busy) this.update({ wifiPrinter: value }); }
  async reprint(result: RawSplitResult, only?: RawSplitRoll): Promise<void> {
    if (!this.isCurrent() || this.state.busy) return;
    if (!this.writeAllowed()) { this.options.onMessage('Sessiya xavfsizligi tasdiqlanmaguncha chop etib bo‘lmaydi.'); return; }
    this.update({ busy: true, error: null });
    try {
      if (!this.state.printer) { await this.selectPrinter(); if (!this.state.printer) return; }
      const printer = this.state.printer;
      if (!this.options.printerSupported(printer, this.state.wifiPrinter)) { this.options.onUnsupportedPrinter(printer, this.state.wifiPrinter); return; }
      for (const output of only ? [only] : result.outputs) {
        if (!this.isCurrent()) return;
        this.checkWriteScope();
        await this.options.printOne(result, output, printer, this.state.wifiPrinter, this.checkWriteScope);
      }
      this.checkWriteScope(); this.options.onMessage('Chop etildi');
    } catch (reason) { this.update({ error: `Ombordagi hisob o‘zgarmadi. Chop etish: ${message(reason)}` }); }
    finally { this.update({ busy: false }); }
  }
}
