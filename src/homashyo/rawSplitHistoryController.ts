import type { Session } from '../auth';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { rawSplitSnapshot } from './rawSplitApi';
import type { RawSplitResult, RawSplitRoll, RawSplitSnapshot } from './rawSplitModel';

type Device = PreparationDeviceSelection;
export type RawSplitHistoryState = { snapshot: RawSplitSnapshot | null; printer: Device | null; wifiPrinter: string;
  error: string | null; busy: boolean };
export type RawSplitHistoryOptions = { session: Session; selectPrinter: () => Promise<Device | null>;
  printOne: (result: RawSplitResult, output: RawSplitRoll, printer: Device, wifiPrinter: string) => Promise<void>;
  onMessage: (message: string) => void; printerSupported: (printer: Device, wifiPrinter: string) => boolean;
  onUnsupportedPrinter: () => void; snapshot?: typeof rawSplitSnapshot };
const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);

/** State transitions from V2 _RawMaterialSplitHistoryScreenState. */
export class RawSplitHistoryController {
  private active = true;
  private listeners = new Set<() => void>();
  private state: RawSplitHistoryState = { snapshot: null, printer: null, wifiPrinter: 'godex', error: null, busy: false };
  constructor(private readonly options: RawSplitHistoryOptions) {}
  getSnapshot = (): RawSplitHistoryState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  dispose(): void { this.active = false; this.listeners.clear(); }
  private update(patch: Partial<RawSplitHistoryState>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  async reload(): Promise<void> {
    if (!this.active || this.state.busy) return;
    this.update({ busy: true, error: null });
    try { const snapshot = await (this.options.snapshot ?? rawSplitSnapshot)(this.options.session); this.update({ snapshot }); }
    catch (reason) { this.update({ error: message(reason) }); }
    finally { this.update({ busy: false }); }
  }
  async selectPrinter(): Promise<void> {
    const printer = await this.options.selectPrinter();
    if (this.active && printer !== null) this.update({ printer });
  }
  setWifiPrinter(value: string): void { if (!this.state.busy) this.update({ wifiPrinter: value }); }
  async reprint(result: RawSplitResult, only?: RawSplitRoll): Promise<void> {
    if (!this.active || this.state.busy) return;
    this.update({ busy: true, error: null });
    try {
      if (!this.state.printer) { await this.selectPrinter(); if (!this.state.printer) return; }
      const printer = this.state.printer;
      if (!this.options.printerSupported(printer, this.state.wifiPrinter)) { this.options.onUnsupportedPrinter(); return; }
      for (const output of only ? [only] : result.outputs) {
        if (!this.active) return;
        await this.options.printOne(result, output, printer, this.state.wifiPrinter);
      }
      if (this.active) this.options.onMessage('Chop etildi');
    } catch (reason) { this.update({ error: `Ombordagi hisob o‘zgarmadi. Chop etish: ${message(reason)}` }); }
    finally { this.update({ busy: false }); }
  }
}
