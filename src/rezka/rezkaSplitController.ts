import type { SupplierItem } from '../shared/catalogApi';
import type { RezkaOutput, RezkaSource, RezkaSourceResponse, RezkaSplitInput, RezkaSplitResponse } from './rezkaSplitApi';
import { withPreparedOutputs } from './rezkaSplitApi';
import { buildRezkaOutputs, draftFromSource, extractRezkaBarcode, formatRezkaQty, remainderDraft, rezkaOutputTotal, type RezkaDraft } from './rezkaSplitLogic';

export type RezkaTransport = 'offline' | 'bluetooth' | 'wifi';
export type RezkaPrinterTarget = { transport: RezkaTransport; driver_url: string; printer: string; print_mode: string; model?: string };
export type RezkaSplitNotice =
  | { kind: 'sourceError' | 'submitError'; message: string }
  | { kind: 'printerConfig' | 'outputInvalid' | 'usbMissing' | 'bluetoothMissing' | 'printerUnavailable' | 'godexExcluded' }
  | { kind: 'excess'; total: number; sourceQty: number; difference: number; uom: string }
  | { kind: 'remainderAdded'; quantity: number; uom: string; scrap: boolean }
  | { kind: 'serverRemainder'; total: number; sourceQty: number; difference: number; uom: string }
  | { kind: 'serverMismatch'; total: number; sourceQty: number }
  | { kind: 'success'; count: number };
export type RezkaSplitState = { barcode: string; reason: string; driverUrl: string; printer: string; printMode: string; transport: RezkaTransport;
  source: RezkaSource | null; outputs: RezkaDraft[]; loadingSource: boolean; submitting: boolean; uncertain: boolean; blockedPrinter: boolean;
  remainder: { source: RezkaSource; total: number; difference: number } | null; notice: RezkaSplitNotice | null };
export type RezkaSplitDependencies = {
  isCurrent(): boolean;
  canSubmit(): boolean;
  loadSource(barcode: string): Promise<RezkaSourceResponse>;
  resolvePrinter(state: RezkaSplitState): Promise<RezkaPrinterTarget | null>;
  split(request: RezkaSplitInput): Promise<RezkaSplitResponse>;
  prepare(request: RezkaSplitInput): Promise<RezkaSplitResponse>;
  print(output: RezkaOutput, target: RezkaPrinterTarget): Promise<{ ok: boolean }>;
  confirm(request: RezkaSplitInput): Promise<RezkaSplitResponse>;
};
const initial = (): RezkaSplitState => ({ barcode: '', reason: '', driverUrl: 'http://gscale.local:39117', printer: 'godex', printMode: 'label',
  transport: 'offline', source: null, outputs: [], loadingSource: false, submitting: false, uncertain: false, blockedPrinter: false, remainder: null, notice: null });
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function knownServerResponse(error: unknown): boolean {
  return !!error && typeof error === 'object' && typeof (error as { statusCode?: unknown }).statusCode === 'number';
}
export function isExcludedRezkaPrinter(...values: (string | undefined)[]): boolean {
  return values.some(value => !!value && (/go[\s_-]*dex/i.test(value) || /\bg500\b/i.test(value)));
}
function mayHaveExecuted(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { mayHaveExecuted?: unknown }).mayHaveExecuted === true;
}

/** State and actions from @v2 RezkaSplitScreen, independent of the platform and printer picker. */
export class RezkaSplitController {
  private state = initial();
  private listeners = new Set<() => void>();
  private disposed = false;
  private suspended = false;
  private mutationStarted = false;
  private nextDraftKey = 0;
  constructor(private readonly deps: RezkaSplitDependencies) {}
  private keyed(draft: RezkaDraft): RezkaDraft { return { ...draft, key: ++this.nextDraftKey }; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private active() {
    if (this.disposed || this.suspended) return false;
    if (!this.deps.isCurrent()) { this.invalidate(this.mutationStarted); return false; }
    return true;
  }
  private update(change: Partial<RezkaSplitState>) {
    if (!this.active()) return;
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }
  invalidate(uncertain = this.mutationStarted) {
    if (this.disposed) return;
    this.disposed = true;
    this.state = { ...initial(), uncertain };
    this.listeners.forEach(listener => listener());
  }
  suspend() { this.suspended = true; }
  resume() { if (!this.disposed) this.suspended = false; }
  dispose() { this.disposed = true; this.listeners.clear(); }
  setBarcode(barcode: string) { this.update({ barcode }); }
  setReason(reason: string) { this.update({ reason }); }
  setPrinter(values: Partial<Pick<RezkaSplitState, 'transport' | 'driverUrl' | 'printer' | 'printMode'>>) { this.update({ ...values, blockedPrinter: false }); }
  editOutput(index: number, values: Partial<RezkaDraft>) {
    if (!this.active() || !this.state.outputs[index]) return;
    this.update({ outputs: this.state.outputs.map((output, i) => i === index ? { ...output, ...values } : output) });
  }
  selectItem(index: number, item: Pick<SupplierItem, 'code' | 'name' | 'uom' | 'warehouse'>) {
    const output = this.state.outputs[index];
    if (!output) return;
    this.editOutput(index, { item_code: item.code, item_name: item.name, uom: item.uom.trim() ? item.uom : 'kg',
      warehouse: item.warehouse.trim() ? item.warehouse : output.warehouse });
  }
  addOutput() { if (this.state.source) this.update({ outputs: [...this.state.outputs, this.keyed(draftFromSource(this.state.source))] }); }
  removeOutput(index: number) {
    if (this.state.outputs.length > 2 && index >= 0 && index < this.state.outputs.length)
      this.update({ outputs: this.state.outputs.filter((_item, i) => i !== index) });
  }
  clearNotice() { this.update({ notice: null }); }
  async scan(value: string) {
    if (!this.active() || !value.trim()) return;
    this.update({ barcode: extractRezkaBarcode(value) ?? value.trim() });
    await this.loadSource();
  }
  async loadSource() {
    if (!this.active() || this.state.loadingSource) return;
    const barcode = extractRezkaBarcode(this.state.barcode) ?? this.state.barcode.trim();
    if (!barcode) return;
    this.update({ barcode, loadingSource: true });
    try {
      const response = await this.deps.loadSource(barcode);
      if (!this.active()) return;
      this.update({ source: response.source, outputs: [this.keyed(draftFromSource(response.source)), this.keyed(draftFromSource(response.source))] });
    } catch (error) {
      if (this.active()) this.update({ notice: { kind: 'sourceError', message: errorMessage(error) } });
    } finally { if (this.active()) this.update({ loadingSource: false }); }
  }
  chooseRemainder(choice: 'forgot' | 'scrap' | 'cancel') {
    const remainder = this.state.remainder;
    if (!this.active() || !remainder) return;
    if (choice === 'cancel') { this.update({ remainder: null }); return; }
    const scrap = choice === 'scrap';
    this.update({ remainder: null, outputs: [...this.state.outputs, this.keyed(remainderDraft(remainder.source, remainder.difference, scrap))],
      notice: { kind: 'remainderAdded', quantity: remainder.difference, uom: remainder.source.uom, scrap } });
  }
  async submit() {
    if (!this.active() || !this.deps.canSubmit() || this.state.submitting || this.state.uncertain || this.state.blockedPrinter || !this.state.source) return;
    const source = this.state.source, snapshot = this.state;
    if (snapshot.transport === 'wifi' && (!snapshot.driverUrl.trim() || !snapshot.printer.trim() || !snapshot.printMode.trim())) {
      this.update({ notice: { kind: 'printerConfig' } }); return;
    }
    const outputs = buildRezkaOutputs(source, snapshot.outputs);
    if (!outputs) { this.update({ notice: { kind: 'outputInvalid' } }); return; }
    const quantities = outputs.map(item => item.qty), total = rezkaOutputTotal(source, quantities);
    if (total.kind === 'remainder') { this.update({ remainder: { source, total: total.total, difference: total.difference } }); return; }
    if (total.kind === 'excess') {
      this.update({ notice: { kind: 'excess', total: total.total, sourceQty: source.qty, difference: -total.difference, uom: source.uom } }); return;
    }
    // Guard the asynchronous printer lookup too: a second tap must not launch a duplicate write.
    this.update({ submitting: true, notice: null });
    let requestSent = false, prepared = false, printAttempted = false;
    try {
      const target: RezkaPrinterTarget | null = snapshot.transport === 'wifi'
        ? { transport: 'wifi', driver_url: snapshot.driverUrl.trim(), printer: snapshot.printer.trim(), print_mode: snapshot.printMode.trim() }
        : await this.deps.resolvePrinter(snapshot);
      if (!this.active()) return;
      if (!target) {
        this.update({ notice: { kind: snapshot.transport === 'bluetooth' ? 'bluetoothMissing' : snapshot.transport === 'offline' ? 'usbMissing' : 'printerUnavailable' } });
        return;
      }
      if (isExcludedRezkaPrinter(target.printer, target.model)) { this.update({ blockedPrinter: true, notice: { kind: 'godexExcluded' } }); return; }
      const request: RezkaSplitInput = { source_barcode: source.barcode, source_stock_entry: source.stock_entry_name,
        source_line_index: source.line_index, reason: snapshot.reason, driver_url: target.driver_url, printer: target.printer,
        print_mode: target.print_mode, outputs };
      let response: RezkaSplitResponse;
      requestSent = true; this.mutationStarted = true;
      if (target.transport === 'wifi') response = await this.deps.split(request);
      else {
        const result = await this.deps.prepare(request);
        prepared = true;
        if (!this.active()) return;
        if (!result.ok) { this.update({ uncertain: true }); return; }
        const confirm = withPreparedOutputs(request, result.outputs);
        if (result.outputs.some((output, index) => output.print_qr !== (request.outputs[index].print_qr !== false) ||
            (output.print_qr && !output.epc.trim()))) { this.update({ uncertain: true }); return; }
        for (const output of result.outputs) {
          if (!output.print_qr || !output.epc.trim()) continue;
          if (!this.active()) return;
          printAttempted = true;
          const printed = await this.deps.print(output, target);
          if (!this.active()) return;
          if (!printed.ok) { this.update({ uncertain: true }); return; }
        }
        if (!this.active()) return;
        response = await this.deps.confirm(confirm);
      }
      if (!this.active()) return;
      if (!response.ok) { this.update({ uncertain: true }); return; }
      this.update({ notice: { kind: 'success', count: response.outputs.filter(output => output.print_qr).length } });
    } catch (error) {
      if (!this.active()) return;
      // A transport failure after a mutation or any partial physical print has an unknown outcome.
      if (mayHaveExecuted(error) || printAttempted || (requestSent && !knownServerResponse(error))) {
        this.update({ uncertain: true }); return;
      }
      const message = errorMessage(error), match = /output_total_must_equal_source_qty:([0-9.]+)!=([0-9.]+)/.exec(message);
      if (!match) { this.update({ notice: { kind: 'submitError', message } }); return; }
      const totalValue = Number(match[1]) || 0, sourceQty = Number(match[2]) || 0, difference = sourceQty - totalValue;
      const current = this.state.source;
      if (current && difference > 0.0001) {
        this.update({ outputs: [...this.state.outputs, this.keyed(remainderDraft(current, difference, false))],
          notice: { kind: 'serverRemainder', total: totalValue, sourceQty, difference, uom: current.uom } });
      } else this.update({ notice: { kind: 'serverMismatch', total: totalValue, sourceQty } });
    } finally {
      if (this.active()) this.update({ submitting: false, ...(prepared && !this.state.notice ? { uncertain: true } : {}) });
      this.mutationStarted = false;
    }
  }
}

/** Exact Uzbek source messages, with quantities formatted like the V2 widget. */
export function rezkaSplitNoticeText(notice: RezkaSplitNotice): string | null {
  switch (notice.kind) {
    case 'sourceError': case 'submitError': return notice.message;
    case 'printerConfig': return 'Printer sozlamasi to‘liq emas.';
    case 'outputInvalid': return 'QR chiqadigan bo‘lakda mahsulot, qty va location bo‘lsin. Atxotda qty va location yetarli.';
    case 'usbMissing': return 'GoDEX yoki Zebra USB printer topilmadi.';
    case 'bluetoothMissing': return 'XP-P323B Bluetooth printer tanlang.';
    case 'godexExcluded': case 'printerUnavailable': return null;
    case 'excess': return `Bo‘laklar jami ${formatRezkaQty(notice.total)} ${notice.uom} bo‘lib ketdi. Asl mahsulot ${formatRezkaQty(notice.sourceQty)} ${notice.uom}. ${formatRezkaQty(notice.difference)} ${notice.uom} ortiq yozilgan.`;
    case 'remainderAdded': return notice.scrap
      ? `Qoldiq ${formatRezkaQty(notice.quantity)} ${notice.uom} brak sifatida brak - ombori - A omborga yozildi.`
      : `Qoldiq ${formatRezkaQty(notice.quantity)} ${notice.uom} yangi bo‘lakka ochildi, mahsulotini tanlang.`;
    case 'serverRemainder': return `Bo‘linayotgan mahsulot ${formatRezkaQty(notice.sourceQty)} ${notice.uom}. Bo‘laklar jami ${formatRezkaQty(notice.total)} ${notice.uom}. ${formatRezkaQty(notice.difference)} ${notice.uom} kam. Qolganini yangi bo‘lakka ochdim.`;
    case 'serverMismatch': return `Bo‘laklar jami ${formatRezkaQty(notice.total)}, asl mahsulot ${formatRezkaQty(notice.sourceQty)}. Miqdorlarni teng qilib yozing.`;
    case 'success': return `${notice.count} ta QR chiqarildi.`;
  }
}
