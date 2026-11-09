import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import { trimDart } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';
import { qolipSimpleLower } from './qolipSimpleLower';

export type QolipPaddonCreateDraft = Readonly<{ warehouse: string; location: string; note: string }>;
type CreateSnapshot = Readonly<{ invalid: boolean; warehouse: string | null; canSubmit: boolean }>;
const invalidCreate: CreateSnapshot = Object.freeze({ invalid: true, warehouse: null, canSubmit: false });

/** @v2 _PaddonCreateDialogState */
export class QolipPaddonCreateState {
  private options: readonly string[];
  private readonly lifetime: QolipLocationChoiceLifetime;
  private warehouse: string | null;
  private value: typeof invalidCreate;
  private readonly listeners = new Set<() => void>();
  private stop: (() => void) | null = null;
  constructor(warehouses: readonly string[], initial: Partial<QolipPaddonCreateDraft> | null | undefined, boundary: QolipHomeReadBoundary) {
    this.options = Object.freeze([...warehouses]);
    this.warehouse = warehouses.length === 1 ? warehouses[0] : null;
    if (initial?.warehouse !== undefined && warehouses.includes(initial.warehouse)) this.warehouse = initial.warehouse;
    this.lifetime = new QolipLocationChoiceLifetime(boundary);
    this.value = this.project();
  }
  private project() { return Object.freeze({ invalid: false, warehouse: this.warehouse, canSubmit: this.warehouse !== null }); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.lifetime.getSnapshot() ? this.value : invalidCreate;
  get warehouses() { return this.lifetime.getSnapshot() ? this.options : []; }
  canAct = () => this.lifetime.canChoose();
  private notify() { for (const listener of [...this.listeners]) { try { const value: unknown = listener(); if (value && typeof (value as PromiseLike<unknown>).then === 'function') void Promise.resolve(value).catch(() => {}); } catch { /* Notify all observers. */ } } }
  activate() { this.stop ??= this.lifetime.subscribe(() => this.notify()); this.lifetime.activate(); }
  updateWarehouses(warehouses: readonly string[]) {
    if (!this.canAct() || JSON.stringify(warehouses) === JSON.stringify(this.options)) return;
    this.options = Object.freeze([...warehouses]); this.value = this.project(); this.notify();
  }
  choose(warehouse: string) { if (this.canAct() && this.warehouses.includes(warehouse)) { this.warehouse = warehouse; this.value = this.project(); this.notify(); } }
  submit(): QolipPaddonCreateDraft | null { return this.canAct() && this.warehouse !== null ? { warehouse: this.warehouse, location: '', note: '' } : null; }
  suspend() { this.stop?.(); this.stop = null; this.lifetime.suspend(); }
}

type InspectionSnapshot = Readonly<{ invalid: boolean; scanning: boolean; codes: readonly Readonly<{ key: string; value: string }>[];
  found: readonly string[]; missing: readonly string[]; unexpected: readonly string[] }>;
const invalidInspection: InspectionSnapshot = Object.freeze({ invalid: true, scanning: false, codes: [], found: [], missing: [], unexpected: [] });

/** @v2 _InspectionDialogState */
export class QolipInspectionState {
  private readonly expected = new Map<string, string>();
  private readonly codes = new Map<string, string>();
  private readonly lifetime: QolipLocationChoiceLifetime;
  private value: InspectionSnapshot;
  private generation = 0;
  private stop: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(expected: readonly string[], boundary: QolipHomeReadBoundary, private readonly scanRaw: () => Promise<string | null>,
    private readonly parseCode: (raw: string) => string = rawMaterialBarcodeFromQr) {
    for (const code of expected) this.expected.set(qolipSimpleLower(code), code);
    this.lifetime = new QolipLocationChoiceLifetime(boundary); this.value = this.project(false);
  }
  private project(scanning: boolean): InspectionSnapshot {
    return { invalid: false, scanning, codes: [...this.codes].map(([key, value]) => ({ key, value })),
      found: [...this.codes.keys()].filter(key => this.expected.has(key)).map(key => this.expected.get(key)!),
      missing: [...this.expected].filter(([key]) => !this.codes.has(key)).map(([, value]) => value),
      unexpected: [...this.codes].filter(([key]) => !this.expected.has(key)).map(([, value]) => value) };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.lifetime.getSnapshot() ? this.value : invalidInspection;
  canAct = () => this.lifetime.canChoose();
  private notify() { for (const listener of [...this.listeners]) { try { const value: unknown = listener(); if (value && typeof (value as PromiseLike<unknown>).then === 'function') void Promise.resolve(value).catch(() => {}); } catch { /* Notify all observers. */ } } }
  activate() { this.stop ??= this.lifetime.subscribe(() => { this.generation++; this.codes.clear(); this.value = invalidInspection; this.notify(); }); this.lifetime.activate(); }
  updateExpected(expected: readonly string[]) {
    if (!this.canAct()) return;
    const next = new Map<string, string>(); for (const code of expected) next.set(qolipSimpleLower(code), code);
    if (JSON.stringify([...next]) === JSON.stringify([...this.expected])) return;
    this.expected.clear(); for (const [key, value] of next) this.expected.set(key, value);
    this.value = this.project(this.value.scanning); this.notify();
  }
  async scan(): Promise<void> {
    if (!this.canAct() || this.value.scanning) return;
    const generation = this.generation, current = () => generation === this.generation && this.canAct();
    this.value = this.project(true); this.notify(); if (!current()) return;
    const raw = await this.scanRaw();
    if (!current()) return;
    this.value = this.project(false);
    if (raw !== null && trimDart(raw)) { const code = this.parseCode(raw); if (current()) this.codes.set(qolipSimpleLower(code), code); }
    if (current()) { this.value = this.project(false); this.notify(); }
  }
  remove(key: string) { if (this.canAct() && this.codes.has(key)) { this.codes.delete(key); this.value = this.project(this.value.scanning); this.notify(); } }
  result(): readonly string[] | null { return this.canAct() && !this.value.scanning ? [...this.codes.values()] : null; }
  canCancel() { return this.canAct() && !this.value.scanning; }
  suspend() { this.generation++; this.stop?.(); this.stop = null; this.lifetime.suspend(); this.value = this.project(false); }
}
