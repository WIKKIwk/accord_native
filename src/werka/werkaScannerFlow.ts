import type { WerkaGuardEvaluator } from './werkaGuardTypes';
import { parseWerkaArchiveBatchQr } from './werkaArchiveBatchQr';
import { extractWerkaLookupBarcode, firstWerkaBarcodeValue, resolveWerkaScannedCode, werkaScanErrorMessage } from './werkaScanLogic';
import type { werkaQrPreview } from './werkaPaddonApi';

export type WerkaScanResult = Exclude<Awaited<ReturnType<typeof resolveWerkaScannedCode>>, { kind: 'invalid' }>;
export type WerkaScannerState = Readonly<{ processing: boolean; manualEntry: boolean; status: string }>;
type Dependencies = {
  /** Must capture the originating auth generation, identity, scope and role permission. */
  isCurrent: () => boolean;
  /** Required verified evaluator; this branch deliberately supplies no fallback. */
  evaluateGuard: WerkaGuardEvaluator;
  /** Completion only reflects what the supplied camera adapter can actually guarantee. */
  stopCamera: () => Promise<void>;
  startCamera: () => Promise<'running' | 'suspended' | 'error'>;
  /** The eventual API adapter must also guard its initial request and every auth retry. */
  preview: (code: string) => ReturnType<typeof werkaQrPreview>;
  onState: (state: WerkaScannerState) => void;
  onNotice: (message: string) => void;
  /** No navigation is implemented here; the eventual caller must recheck scope and route safety. */
  onResult: (result: WerkaScanResult) => void;
};

const READY = 'QR kodni ramkaga keltiring';

/** Werka-specific lock, dialog and retry orchestration. It does not own camera or routes. */
export class WerkaScannerFlow {
  private state: WerkaScannerState = { processing: false, manualEntry: false, status: READY };
  private disposed = false;
  constructor(private readonly deps: Dependencies) {}
  getSnapshot(): WerkaScannerState | null { return this.current() ? this.state : null; }
  private current(): boolean {
    if (this.disposed) return false;
    const guard = this.deps.isCurrent, evaluate = this.deps.evaluateGuard;
    try { return evaluate(guard) === true && !this.disposed && this.deps.isCurrent === guard && this.deps.evaluateGuard === evaluate; }
    catch { return false; }
  }
  private update(patch: Partial<WerkaScannerState>): void {
    if (!this.current()) return;
    this.state = { ...this.state, ...patch }; this.deps.onState(this.state);
  }
  /** The owner must also unmount the camera and react to auth changes. */
  dispose(): void { this.disposed = true; }

  private async restart(): Promise<void> {
    if (!this.current() || this.state.processing) return;
    let phase: 'running' | 'suspended' | 'error';
    try { phase = await this.deps.startCamera(); } catch { phase = 'error'; }
    if (!this.current() || this.state.processing) return;
    this.update({ status: phase === 'error' ? 'Kamera ochilmadi' : READY });
  }
  async retryCamera(): Promise<void> { await this.restart(); }

  async onDetection(barcodes: readonly { rawValue?: string | null; displayValue?: string | null }[]): Promise<void> {
    await this.handleCode(firstWerkaBarcodeValue(barcodes));
  }
  async enterManual(prompt: () => Promise<string | null>): Promise<void> {
    if (!this.current() || this.state.processing) return;
    this.update({ processing: true, manualEntry: true });
    if (!this.current()) return;
    try {
      await this.deps.stopCamera();
      if (!this.current()) return;
      const entered = await prompt();
      if (!this.current()) return;
      this.update({ processing: false, manualEntry: false });
      if (entered === null) await this.restart();
      else await this.handleCode(entered.trim());
    } catch (error) {
      if (!this.current()) return;
      const message = werkaScanErrorMessage(error);
      this.update({ processing: false, manualEntry: false, status: message });
      if (!this.current()) return;
      this.deps.onNotice(message);
      await this.restart();
    }
  }
  async handleCode(raw: string): Promise<void> {
    if (!this.current() || this.state.processing) return;
    const archive = parseWerkaArchiveBatchQr(raw);
    if (!archive && !extractWerkaLookupBarcode(raw)) {
      this.update({ status: 'QR kodi noto‘g‘ri' });
      if (!this.current()) return;
      this.deps.onNotice('QR kodi noto‘g‘ri.');
      await this.restart();
      return;
    }
    this.update({ processing: true, manualEntry: false,
      status: archive ? 'Batch QR o‘qildi...' : 'Barcode tekshirilmoqda...' });
    if (!this.current()) return;
    try {
      await this.deps.stopCamera();
      if (!this.current()) return;
      const result = await resolveWerkaScannedCode(raw, this.deps.preview);
      if (!this.current()) return;
      if (result.kind !== 'invalid') this.deps.onResult(result);
    } catch (error) {
      if (!this.current()) return;
      const message = werkaScanErrorMessage(error);
      this.update({ processing: false, status: message });
      if (!this.current()) return;
      this.deps.onNotice(message);
      await this.restart();
    }
  }
}
