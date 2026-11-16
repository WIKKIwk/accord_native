import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { MobileApiException } from '../shared/mobileApiException';
import type { RawMaterialReprint, RawMaterialStock } from '../shared/printApi';
import type { WorkerPrintJob } from '../workerPrintJob';
import type { AdminWarehouseMainActionContext } from './AdminWarehouseMainScreenTypes';
import { dartTrim } from './dartJsonString';

type ErrorText = { key: string } | { message: string };
export type AdminWarehouseRawQrPresentation = { id: number; stock: RawMaterialStock; orderId: string; printing: boolean; error: ErrorText | null; notice: number | null; closing: boolean };
type State = { valid: boolean; presentation: AdminWarehouseRawQrPresentation | null };
type Dependencies = { current: () => boolean; prepare: (barcode: string, orderId: string, guard: () => void) => Promise<RawMaterialReprint>;
  print: (job: WorkerPrintJob, guard: () => void) => Promise<boolean>; confirm: (barcode: string, id: string, guard: () => void) => Promise<void> };
export class AdminWarehouseRawQrController {
  private state: State = { valid: true, presentation: null }; private listeners = new Set<() => void>(); private active = false; private lifetime = 0; private serial = 0; private operation = 0; private opening = false;
  private context: AdminWarehouseMainActionContext | null = null; private resolve: (() => void) | null = null;
  private notices: number[] = [];
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<State>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private current(lifetime = this.lifetime) {
    if (!this.active || !this.state.valid || lifetime !== this.lifetime) return false;
    if (!isSynchronouslyTrue(this.deps.current)) { this.invalidate(); return false; }
    return this.active && this.state.valid && lifetime === this.lifetime;
  }
  currentPresentation = (id: number, lifetime = this.lifetime) => {
    if (!this.current(lifetime) || this.state.presentation?.id !== id || this.state.presentation.closing || !this.context) return false;
    const context = this.context;
    if (!isSynchronouslyTrue(context.isCurrent)) { if (this.context === context && this.state.presentation?.id === id) this.close(id); return false; }
    return this.current(lifetime) && this.state.presentation?.id === id && !this.state.presentation.closing && this.context === context;
  };
  start() { if (!this.active && this.state.valid) { this.active = true; this.lifetime++; if (!this.current()) this.invalidate(); } }
  dispose() { this.active = false; this.lifetime++; this.operation++; this.notices = []; const resolve = this.resolve; this.resolve = null; this.context = null; this.publish({ presentation: null }); resolve?.(); }
  invalidate() { if (!this.state.valid) return; this.state = { ...this.state, valid: false }; this.dispose(); }
  open = (stock: RawMaterialStock, orderId: string, context: AdminWarehouseMainActionContext): Promise<void> => {
    if (this.opening) return Promise.resolve(); this.opening = true;
    try {
      if (!this.current() || this.state.presentation || !isSynchronouslyTrue(context.isCurrent) || !dartTrim(stock.barcode) || !this.current() || this.state.presentation) return Promise.resolve();
      const result = new Promise<void>(resolve => { this.resolve = resolve; }); this.context = context; this.notices = [];
      this.publish({ presentation: { id: ++this.serial, stock, orderId: dartTrim(orderId) ? orderId : stock.reserved_order_id, printing: false, error: null, notice: null, closing: false } }); return result;
    } finally { this.opening = false; }
  };
  beginDismiss(id: number) { if (this.state.presentation?.id === id) { this.operation++; this.publish({ presentation: { ...this.state.presentation, closing: true } }); } }
  close(id: number, closeButton = false) {
    if (this.state.presentation?.id !== id || closeButton && this.state.presentation.printing) return;
    if (closeButton) { this.beginDismiss(id); return; }
    this.operation++; this.notices = []; const resolve = this.resolve; this.resolve = null; this.context = null; this.publish({ presentation: null }); resolve?.();
  }
  dismissNotice(id: number, serial: number) {
    const value = this.state.presentation; if (!value || value.id !== id || value.notice !== serial || !this.currentPresentation(id)) return;
    if (this.notices[0] === serial) this.notices.shift(); this.publish({ presentation: { ...value, notice: this.notices[0] ?? null } });
  }
  reprint = async (id: number): Promise<void> => {
    const value = this.state.presentation; if (!value || value.printing || !this.currentPresentation(id)) return;
    const operation = ++this.operation, lifetime = this.lifetime, witness = () => operation === this.operation && this.currentPresentation(id, lifetime), guard = () => { if (!witness()) throw new Error('Warehouse QR operation changed'); };
    this.publish({ presentation: { ...value, printing: true, error: null } });
    try {
      guard(); const barcode = value.stock.barcode, receipt = dartTrim(value.stock.source_receipt_id), expected = dartTrim(barcode).toUpperCase(); guard();
      const prepared = await this.deps.prepare(barcode, value.orderId, guard); guard();
      const mismatch = !dartTrim(prepared.reprint_id) || dartTrim(prepared.stock.barcode).toUpperCase() !== expected || dartTrim(prepared.stock.source_receipt_id) !== receipt || dartTrim(prepared.print_request.epc).toUpperCase() !== expected; guard();
      if (mismatch) {
        this.publish({ presentation: { ...this.state.presentation!, printing: false, error: { key: 'warehouse.qr_identity_mismatch' } } }); return;
      }
      guard(); if (!await this.deps.print(prepared.print_request, guard)) throw new Error('Printer QR failed'); guard();
      let warning = false;
      try { await this.deps.confirm(prepared.stock.barcode, prepared.reprint_id, guard); guard(); } catch { guard(); warning = true; }
      guard(); this.notices.push(++this.serial); this.publish({ presentation: { ...this.state.presentation!, printing: false, error: warning ? { key: 'warehouse.qr_confirmation_failed' } : null, notice: this.notices[0] } });
    } catch (error) {
      if (witness()) this.publish({ presentation: { ...this.state.presentation!, printing: false, error: error instanceof MobileApiException ? { message: error.message } : { key: 'warehouse.qr_print_failed' } } });
    }
  };
}
