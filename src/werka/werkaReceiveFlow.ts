import type { WerkaGuardEvaluator } from './werkaGuardTypes';
import { MobileApiException } from '../shared/mobileApiException';
import { WorkerControlException } from '../workerControlsApi';
import type { WerkaPaddonPreview, WerkaWipPreview } from './werkaPaddonApi';
import { canReceiveWerkaPaddon, canReceiveWerkaWip, sameWerkaWipIdentity, werkaWarehouseAfterPreview } from './werkaReceiveLogic';

export type WerkaReceivePreview = { kind: 'paddon'; value: WerkaPaddonPreview } | { kind: 'wip'; value: WerkaWipPreview };
export type WerkaReceiveFlowState = Readonly<{
  preview: WerkaReceivePreview; receipt: Record<string, unknown> | null; warehouse: string | null;
  busy: boolean; confirming: boolean; mustReload: boolean; uncertainWrite: boolean; error: string;
}>;
type Confirmation = { title: string; message: string; cancelLabel: string; confirmLabel: string };
type Dependencies = {
  /** Capture the originating auth generation, identity, scope and permission. */
  isCurrent: () => boolean;
  /** Required verified evaluator; this branch deliberately supplies no fallback. */
  evaluateGuard: WerkaGuardEvaluator;
  /** The adapter must itself guard initial send, retry, redirects and response decoding as appropriate. */
  loadPreview: (current: WerkaReceivePreview) => Promise<WerkaReceivePreview>;
  /** The actual adapter must use the scope-guarded role mutation and never auto-repeat an uncertain write. */
  receive: (preview: WerkaReceivePreview, warehouse: string) => Promise<Record<string, unknown>>;
  confirm: (details: Confirmation) => Promise<boolean | null>;
  label: (value: string, preview: WerkaReceivePreview) => string;
  onState: (state: WerkaReceiveFlowState) => void;
};
const isApiError = (error: unknown): error is MobileApiException | WorkerControlException =>
  error instanceof MobileApiException || error instanceof WorkerControlException;

/** Source error text; a sent request may already have committed. */
export function werkaReceiveErrorMessage(kind: WerkaReceivePreview['kind'], error: unknown, receiving = false): string {
  if (isApiError(error)) {
    if (kind === 'paddon') {
      switch (error.code) {
        case 'forbidden': return 'Bu amalga yoki omborga ruxsat yo‘q. Sizga ombor biriktirilganini tekshiring.';
        case 'paddon_not_found': return 'Paddon topilmadi. QR kodni tekshiring.';
        case 'paddon_receipt_conflict': return 'Paddon tarkibi yoki rulon ma’lumoti o‘zgargan. Qayta tekshiring.';
        case 'paddon_already_received': return 'Paddon avval kirim qilingan. Qayta tekshiring.';
        case 'progress_batch_not_accepted': return 'Paddonda kirimga tayyor bo‘lmagan yoki avval qabul qilingan rulon bor.';
        case 'paddon_invalid_input': return 'Paddon bo‘sh yoki kirim ma’lumotlari yetarli emas.';
        default: return 'Kirimni tekshirib bo‘lmadi. Qayta tekshiring.';
      }
    }
    switch (error.code) {
      case 'forbidden': return 'Bu amalga yoki omborga ruxsat yo‘q.';
      case 'wip_receipt_conflict': case 'progress_batch_revision_conflict': return 'WIP ma’lumoti o‘zgargan. Qayta tekshiring.';
      case 'progress_batch_not_accepted': return 'WIP kirimga tayyor emas yoki avval ishlatilgan. Qayta tekshiring.';
      case 'wip_already_received': return 'WIP avval kirim qilingan. Qayta tekshiring.';
      case 'qr_not_found': case 'progress_batch_not_found': case 'progress_qr_invalid': return 'WIP topilmadi yoki QR kodi noto‘g‘ri.';
      default: return receiving ? 'Kirim natijasi tasdiqlanmadi. Qayta tekshiring.' : 'WIP ma’lumotini olib bo‘lmadi. Qayta tekshiring.';
    }
  }
  return receiving ? 'Server javobi olinmadi. Kirim bajarilgan bo‘lishi mumkin. Qayta tekshiring.'
    : 'Server javobi olinmadi. Qayta tekshiring.';
}
function fingerprint(preview: WerkaReceivePreview): string | null {
  try { return JSON.stringify(preview); } catch { return null; }
}
function conflict(kind: WerkaReceivePreview['kind']): string {
  return kind === 'paddon' ? 'Paddon tarkibi yoki rulon ma’lumoti o‘zgargan. Qayta tekshiring.'
    : 'WIP ma’lumoti o‘zgargan. Qayta tekshiring.';
}

/** Unwired state flow only. The owner must remount on auth changes and reconcile interrupted writes. */
export class WerkaReceiveFlow {
  private state: WerkaReceiveFlowState;
  private disposed = false;
  constructor(preview: WerkaReceivePreview, private readonly deps: Dependencies) {
    this.state = { preview, receipt: preview.value.receipt, warehouse: werkaWarehouseAfterPreview(preview.value.warehouses, null),
      busy: false, confirming: false, mustReload: false, uncertainWrite: false, error: '' };
  }
  getSnapshot(): WerkaReceiveFlowState | null { return this.current() ? this.state : null; }
  private current(): boolean {
    if (this.disposed) return false;
    const guard = this.deps.isCurrent, evaluate = this.deps.evaluateGuard;
    try { return evaluate(guard) === true && !this.disposed && this.deps.isCurrent === guard && this.deps.evaluateGuard === evaluate; }
    catch { return false; }
  }
  private update(patch: Partial<WerkaReceiveFlowState>): void {
    if (!this.current()) return;
    this.state = { ...this.state, ...patch }; this.deps.onState(this.state);
  }
  dispose(): void { this.disposed = true; }
  selectWarehouse(warehouse: string | null): void {
    if (!this.current() || this.state.busy) return;
    if (warehouse !== null && !this.state.preview.value.warehouses.includes(warehouse)) return;
    this.update({ warehouse });
  }
  canReceive(): boolean {
    if (!this.current() || this.state.uncertainWrite) return false;
    return this.state.preview.kind === 'paddon'
      ? canReceiveWerkaPaddon(this.state.preview.value, this.state)
      : canReceiveWerkaWip(this.state.preview.value, this.state);
  }
  async reload(): Promise<void> {
    if (!this.current() || this.state.busy) return;
    const previous = this.state.preview;
    this.update({ busy: true, error: '' });
    if (!this.current()) return;
    try {
      const fresh = await this.deps.loadPreview(previous);
      if (!this.current()) return;
      if (fresh.kind !== previous.kind || (previous.kind === 'wip' && fresh.kind === 'wip' && !sameWerkaWipIdentity(previous.value, fresh.value))) {
        throw new MobileApiException({ code: 'qr_preview_invalid', message: 'WIP identity changed' });
      }
      this.update({ preview: fresh, receipt: fresh.value.receipt, mustReload: this.state.uncertainWrite,
        warehouse: werkaWarehouseAfterPreview(fresh.value.warehouses, this.state.warehouse) });
    } catch (error) {
      if (this.current()) this.update({ error: werkaReceiveErrorMessage(previous.kind, error), mustReload: true });
    } finally { if (this.current()) this.update({ busy: false }); }
  }
  async accept(): Promise<void> {
    if (!this.canReceive()) return;
    const preview = this.state.preview, warehouse = this.state.warehouse!, signature = fingerprint(preview);
    if (signature === null) { this.update({ mustReload: true, error: conflict(preview.kind) }); return; }
    const label = (value: string) => this.deps.label(value, preview);
    const details: Confirmation = preview.kind === 'paddon'
      ? { title: 'Paddonni kirim qilish', message: `${preview.value.snapshot.paddon.code} paddonidagi ${preview.value.snapshot.items.length} ta rulon «${label(warehouse)}» omboriga qabul qilinadi.`,
          cancelLabel: 'Bekor qilish', confirmLabel: 'Kirim qilish' }
      : { title: 'WIPni kirim qilish', message: `${label(preview.value.batch.label_item_name)} WIP «${label(warehouse)}» omboriga qabul qilinadi.`,
          cancelLabel: 'Bekor qilish', confirmLabel: 'Kirim qilish' };
    this.update({ busy: true, confirming: true });
    if (!this.current()) return;
    let writeAttempted = false;
    try {
      const confirmed = await this.deps.confirm(details);
      if (!this.current()) return;
      this.update({ confirming: false, busy: confirmed === true });
      if (!this.current() || confirmed !== true) return;
      // A mutable JS preview must still describe the exact input the user confirmed.
      if (fingerprint(preview) !== signature || this.state.warehouse !== warehouse) {
        this.update({ busy: false, mustReload: true, error: conflict(preview.kind) }); return;
      }
      writeAttempted = true;
      const receipt = await this.deps.receive(preview, warehouse);
      if (this.current()) this.update({ receipt, error: '' });
    } catch (error) {
      if (this.current()) this.update({ error: werkaReceiveErrorMessage(preview.kind, error, writeAttempted),
        mustReload: true, uncertainWrite: this.state.uncertainWrite || writeAttempted });
    } finally { if (this.current()) this.update({ busy: false, confirming: false }); }
  }
}
