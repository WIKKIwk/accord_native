import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { rawSplitScope, rawSplitSessionIsCurrent, rawSplitSnapshot, type RawSplitSessionTicket } from './rawSplitApi';
import type { RawSplitResult, RawSplitRoll, RawSplitSnapshot } from './rawSplitModel';
import { rawSplitWriteDispatchAllowed } from './rawSplitWritePolicy';

type Device = PreparationDeviceSelection;
export type RawSplitHistoryState = { snapshot: RawSplitSnapshot | null; printer: Device | null; wifiPrinter: string;
  error: string | null; busy: boolean };
export type RawSplitHistoryOptions = { ticket: RawSplitSessionTicket; canMutate: () => boolean; selectPrinter: (isCurrent: () => boolean) => Promise<Device | null>;
  capturePrintLease: () => (() => boolean) | null;
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
  private checkWriteScope = (lease: () => boolean): void => {
    this.checkScope();
    if (!isSynchronouslyTrue(rawSplitWriteDispatchAllowed) || !isSynchronouslyTrue(lease)) throw new Error('Natija olinmadi. Qayta tekshiring.');
    if (!this.writeAllowed()) throw new Error('Sessiya xavfsizligi tasdiqlanmagan');
    this.checkScope();
    if (!isSynchronouslyTrue(rawSplitWriteDispatchAllowed) || !isSynchronouslyTrue(lease)) throw new Error('Natija olinmadi. Qayta tekshiring.');
  };
  capturePrinterLease = (): (() => boolean) | null => {
    if (!isSynchronouslyTrue(rawSplitWriteDispatchAllowed) || !this.isCurrent() || this.state.busy) return null;
    try {
      const lease = this.options.capturePrintLease();
      return lease && isSynchronouslyTrue(lease) ? () => this.isCurrent() && isSynchronouslyTrue(lease) : null;
    } catch { return null; }
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
  private async choosePrinter(lease: () => boolean): Promise<void> {
    if (!this.isCurrent() || !isSynchronouslyTrue(lease)) return;
    const printer = await this.options.selectPrinter(lease);
    if (this.isCurrent() && isSynchronouslyTrue(lease) && printer !== null) this.update({ printer });
  }
  async selectPrinter(): Promise<void> {
    const lease = this.capturePrinterLease(); if (!lease) return;
    await this.choosePrinter(lease);
  }
  setWifiPrinter(value: string): void { if (this.capturePrinterLease()) this.update({ wifiPrinter: value }); }
  async reprint(result: RawSplitResult, only?: RawSplitRoll): Promise<void> {
    const lease = this.capturePrinterLease(); if (!lease) return;
    if (!this.writeAllowed()) { this.options.onMessage('Sessiya xavfsizligi tasdiqlanmaguncha chop etib bo‘lmaydi.'); return; }
    const guard = () => this.checkWriteScope(lease);
    this.update({ busy: true, error: null });
    try {
      if (!this.state.printer) { await this.choosePrinter(lease); if (!this.state.printer) return; }
      guard();
      const printer = this.state.printer;
      if (!this.options.printerSupported(printer, this.state.wifiPrinter)) { this.options.onUnsupportedPrinter(printer, this.state.wifiPrinter); return; }
      for (const output of only ? [only] : result.outputs) {
        if (!this.isCurrent()) return;
        guard();
        await this.options.printOne(result, output, printer, this.state.wifiPrinter, guard);
      }
      guard(); this.options.onMessage('Chop etildi');
    } catch (reason) { this.update({ error: `Ombordagi hisob o‘zgarmadi. Chop etish: ${message(reason)}` }); }
    finally { this.update({ busy: false }); }
  }
}
