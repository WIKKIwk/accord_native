import { MobileApiException } from '../shared/mobileApiException';
import { assertQolipReadCurrent, trimDart, type QolipReadGuard } from './qolipApiCommon';
import type { QolipCellQr } from './qolipQrApi';

export type QolipQrScannerMode = 'cell' | 'raw' | 'universal';
export type QolipQrScannerResult = QolipCellQr | string;
export type QolipQrBarcode = { rawValue?: string | null; displayValue?: string | null };
export type QolipQrScannerSnapshot = { processing: boolean; status: string; generation: number; finished: boolean; invalid: boolean };
type Operations = {
  current: QolipReadGuard;
  stop(): Promise<void>;
  restart(): Promise<boolean>;
  cameraFailed(): boolean;
  lookup(qr: string, current: QolipReadGuard): Promise<QolipCellQr>;
  complete(result: QolipQrScannerResult): void;
  notify(key: string): void;
};

/** V2 _QolipQrScanScreenState._firstBarcodeValue. */
export function qolipFirstBarcodeValue(barcodes: readonly QolipQrBarcode[]): string {
  for (const barcode of barcodes) {
    const raw = trimDart(barcode.rawValue ?? '');
    if (raw) return raw;
    const display = trimDart(barcode.displayValue ?? '');
    if (display) return display;
  }
  return '';
}

/** V2 _QolipQrScanScreenState._messageForError. */
export function qolipScannerErrorKey(error: unknown): string {
  if (error instanceof MobileApiException) {
    if (error.code === 'cell_qr_not_found' || error.code === 'qolip_cell_qr_not_found') return 'scanner.not_found';
    if (error.code === 'qr_required' || error.code === 'qolip_cell_qr_required') return 'scanner.empty';
  }
  return 'scanner.check_failed';
}

export function qolipScannerModeKey(mode: QolipQrScannerMode): 'cell' | 'mold' | 'universal' {
  return mode === 'raw' ? 'mold' : mode;
}

/**
 * V2 detection/stop/lookup/pop and retry flow. The caller supplies its original
 * role witness and focused camera lifetime; a stale operation never publishes.
 * @v2 _QolipQrScanScreenState
 */
export class QolipQrScannerState {
  private value: QolipQrScannerSnapshot;
  private readonly listeners = new Set<() => void>();
  private active = false;
  private revision = 0;
  constructor(readonly mode: QolipQrScannerMode, private readonly ops: Operations) {
    this.value = { processing: false, status: `scanner.prompt.${qolipScannerModeKey(mode)}`, generation: 0, finished: false, invalid: false };
  }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<QolipQrScannerSnapshot>) {
    this.value = { ...this.value, ...patch }; for (const listener of this.listeners) listener();
  }
  private lifetime(revision: number): boolean {
    if (!this.active || revision !== this.revision || this.value.invalid) return false;
    try { assertQolipReadCurrent(this.ops.current); return this.active && revision === this.revision && !this.value.invalid; }
    catch { return false; }
  }
  private current(revision = this.revision): boolean { return !this.value.finished && this.lifetime(revision); }
  canAct = (): boolean => this.current();
  activate(): void { if (!this.value.invalid) this.active = true; }
  suspend(): void {
    if (!this.active && !this.value.processing) return;
    this.active = false; this.revision++;
    this.update({ processing: false, generation: this.value.generation + 1 });
  }
  invalidate(): void { this.suspend(); this.update({ invalid: true }); }
  async retry(): Promise<void> {
    if (!this.current()) return;
    const revision = ++this.revision;
    this.update({ generation: this.value.generation + 1 });
    const started = await this.ops.restart();
    if (!this.current(revision)) return;
    this.update({ processing: false, status: started || !this.ops.cameraFailed()
      ? `scanner.prompt.${qolipScannerModeKey(this.mode)}` : 'scanner.camera_failed' });
  }
  async detect(barcodes: readonly QolipQrBarcode[], generation = this.value.generation): Promise<void> {
    if (this.value.processing || generation !== this.value.generation || !this.current()) return;
    const qr = qolipFirstBarcodeValue(barcodes); if (!qr) return;
    const revision = ++this.revision;
    this.update({ processing: true, status: `scanner.checking.${qolipScannerModeKey(this.mode)}` });
    await this.ops.stop();
    if (!this.current(revision)) return;
    try {
      const result = this.mode === 'cell' ? await this.ops.lookup(qr, () => this.current(revision)) : qr;
      if (!this.current(revision)) return;
      this.update({ finished: true });
      if (this.lifetime(revision)) this.ops.complete(result);
    } catch (error) {
      if (!this.current(revision)) return;
      const key = qolipScannerErrorKey(error);
      this.update({ processing: false, status: key }); this.ops.notify(key);
      if (this.current(revision)) await this.retry();
    }
  }
}
