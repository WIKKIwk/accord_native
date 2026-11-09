import type { PrintDeviceSelection } from '../gscale/gscalePreferences';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import type { createNativeTransientDevicePicker } from '../shared/printing/transientDevicePickerRuntime';

type Request = ReturnType<typeof createNativeTransientDevicePicker>;
type Dependencies = { isCurrent(): boolean; create(isCurrent: () => boolean): Request; render(request: Request | null): void;
  convert(selection: PrintDeviceSelection): PreparationDeviceSelection };

/** The owner renders one native picker overlay. Results settle only after that overlay is removed. */
export class RawSplitPickerCoordinator {
  private active = true;
  private request: Request | null = null; private requestCurrent: (() => boolean) | null = null;
  constructor(private readonly deps: Dependencies) {}
  private current(): boolean { try { return this.active && this.deps.isCurrent() === true; } catch { return false; } }
  async select(actionCurrent: () => boolean = () => true): Promise<PreparationDeviceSelection | null> {
    const current = () => { try { return this.current() && actionCurrent() === true; } catch { return false; } };
    if (!current() || this.request) return null;
    const request = this.deps.create(current); this.request = request; this.requestCurrent = current;
    try {
      this.deps.render(request);
      const selected = await request.result;
      if (!selected || !current() || this.request !== request) return null;
      return this.deps.convert(selected);
    } finally {
      if (this.request === request) { this.request = null; this.requestCurrent = null; if (this.active) this.deps.render(null); }
      request.dispose();
    }
  }
  /** Close an invalidated request immediately; the adapter also rejects queued events synchronously. */
  invalidateIfStale(): void {
    const request = this.request; if (!request || this.requestCurrent?.() !== false) return;
    request.onLeaving(); this.deps.render(null);
  }
  /** The same callback handles Cancel, Android back, and a successful selection. */
  dismiss(request: Request): void {
    if (this.request !== request) return;
    request.onLeaving(); this.deps.render(null);
  }
  removed(request: Request): void { request.onDismiss(); }
  dispose(): void { this.active = false; const request = this.request; this.request = null; this.requestCurrent = null; request?.dispose(); }
}
