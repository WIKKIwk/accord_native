import { AppInstallationInfo, AppUpdateCheckResult, AppUpdateException, type PreparedAppUpdate } from './appUpdateModels';
import { AppUpdateCancellation, type InstallResult } from './appUpdateService';

export type AppUpdateCoordinatorService = {
  readonly endpointKey: string;
  readonly isSupported: boolean;
  releaseChanges(onChange: () => void, onEnd: (error?: unknown) => void): () => void;
  currentAppInfo(): Promise<AppInstallationInfo>;
  check(): Promise<AppUpdateCheckResult>;
  restorePendingUpdate(): Promise<AppUpdateCheckResult | null>;
  rememberUpdate(update: AppUpdateCheckResult): Promise<void>;
  prepareUpdate(update: AppUpdateCheckResult, progress?: (received: number, total: number) => void,
    cancellation?: AppUpdateCancellation): Promise<PreparedAppUpdate>;
  installPreparedUpdate(prepared: PreparedAppUpdate): Promise<InstallResult>;
};
export type AppUpdatePresenter = {
  showManual(coordinator: AppUpdateCoordinator): Promise<void>;
  showReady(coordinator: AppUpdateCoordinator): Promise<void>;
};

/** @v2 AppUpdateCoordinator */
export class AppUpdateCoordinator {
  private readonly listeners = new Set<() => void>();
  private presenter: AppUpdatePresenter | null = null;
  private endpoint: string | null = null;
  private scope = 0;
  private restored = false;
  private remoteKnown = false;
  private foreground = true;
  private disposed = false;
  private dialogOpen = false;
  private manualOpen = false;
  private shownOptionalArtifact: string | null = null;
  private refreshInFlight: Promise<void> | null = null;
  private refreshAgain = false;
  private preparation: AppUpdateCancellation | null = null;
  private preparingArtifact: string | null = null;
  current: AppInstallationInfo | null = null;
  latest: AppUpdateCheckResult | null = null;
  ready: PreparedAppUpdate | null = null;
  checking = false;
  receivedBytes = 0;
  error: string | null = null;
  constructor(private readonly service: AppUpdateCoordinatorService) {}
  get preparing(): boolean { return this.preparingArtifact !== null; }
  get isSupported(): boolean { return this.service.isSupported; }
  get endpointKey(): string { return this.service.endpointKey; }
  releaseChanges(onChange: () => void, onEnd: (error?: unknown) => void): () => void {
    return this.service.releaseChanges(onChange, onEnd);
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { if (!this.disposed) for (const listener of this.listeners) listener(); }
  setForeground(foreground: boolean): void { this.foreground = foreground; if (foreground) this.promptReady(); }

  private syncEndpoint(): void {
    if (this.endpoint === this.endpointKey) return;
    this.endpoint = this.endpointKey; this.scope++; this.preparation?.cancel(); this.preparation = null;
    this.preparingArtifact = null; this.refreshInFlight = null; this.restored = false; this.remoteKnown = false;
    this.refreshAgain = false; this.shownOptionalArtifact = null; this.ready = null; this.latest = null;
    this.current = null; this.error = null;
  }
  async checkAndPrompt(presenter: AppUpdatePresenter, manual: boolean): Promise<void> {
    if (this.disposed || (!manual && !this.isSupported)) return;
    this.presenter = presenter; this.syncEndpoint();
    if (!manual) { this.promptReady(); await this.refresh(); return; }
    if (this.manualOpen || this.dialogOpen) return;
    this.manualOpen = true;
    if (this.ready?.update.manifest) this.shownOptionalArtifact = this.ready.update.manifest.artifactKey;
    try { await presenter.showManual(this); }
    finally { this.manualOpen = false; this.promptReady(); }
  }
  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.syncEndpoint();
    if (this.refreshInFlight) { this.refreshAgain = true; return this.refreshInFlight; }
    const scope = this.scope;
    const promise = this.performRefresh(scope).finally(() => {
      if (scope !== this.scope) return;
      this.refreshInFlight = null;
      if (this.refreshAgain && !this.disposed) { this.refreshAgain = false; void this.refresh(); }
    });
    this.refreshInFlight = promise;
    return promise;
  }
  private async restore(scope: number): Promise<void> {
    try {
      const restored = await this.service.restorePendingUpdate();
      if (this.isCurrent(scope) && !this.remoteKnown && restored) this.accept(restored);
    } catch { /* Corrupt or missing local state cannot interrupt ordinary work. */ }
  }
  private async performRefresh(scope: number): Promise<void> {
    this.checking = true; this.error = null; this.notify();
    if (this.isSupported && !this.restored) { this.restored = true; void this.restore(scope); }
    try {
      const installed = await this.service.currentAppInfo();
      if (!this.isCurrent(scope)) return;
      this.current = installed; this.notify();
      const result = await this.service.check();
      if (!this.isCurrent(scope)) return;
      this.remoteKnown = true; this.accept(result);
    } catch (error) {
      if (this.isCurrent(scope)) this.error = error instanceof AppUpdateException ? error.message : 'Yangilanish tekshirilmadi';
    } finally {
      if (this.isCurrent(scope)) { this.checking = false; this.notify(); }
    }
  }
  private accept(result: AppUpdateCheckResult): void {
    this.latest = result; this.current = result.current; this.error = null;
    if (!result.updateAvailable || !this.isSupported) {
      this.preparation?.cancel(); this.preparation = null; this.preparingArtifact = null; this.ready = null;
      if (this.isSupported) void this.remember(result);
      this.notify(); return;
    }
    const key = result.manifest!.artifactKey;
    if (this.ready?.update.manifest?.artifactKey === key) {
      this.ready = { update: result, path: this.ready.path }; void this.remember(result); this.notify(); this.promptReady(); return;
    }
    if (this.preparingArtifact === key) { void this.remember(result); this.notify(); return; }
    this.preparation?.cancel();
    const cancellation = new AppUpdateCancellation(true);
    this.preparation = cancellation; this.preparingArtifact = key; this.ready = null; this.receivedBytes = 0; this.notify();
    void this.prepare(result, cancellation, this.scope);
  }
  private async remember(result: AppUpdateCheckResult): Promise<void> {
    try { await this.service.rememberUpdate(result); } catch { /* Native download remains durable. */ }
  }
  private async prepare(result: AppUpdateCheckResult, cancellation: AppUpdateCancellation, scope: number): Promise<void> {
    const active = () => this.isCurrent(scope) && this.preparation === cancellation && !cancellation.isCancelled;
    try {
      const prepared = await this.service.prepareUpdate(result, received => {
        if (active()) { this.receivedBytes = received; this.notify(); }
      }, cancellation);
      if (!active()) return;
      this.ready = { update: this.latest!, path: prepared.path }; this.preparingArtifact = null; this.preparation = null;
      this.error = null; this.notify(); this.promptReady();
    } catch (error) {
      if (!active()) return;
      this.preparingArtifact = null; this.preparation = null;
      this.error = error instanceof AppUpdateException ? error.message : 'Yangilanishni tayyorlab bo‘lmadi';
      this.notify();
    }
  }
  async installReady(): Promise<InstallResult> {
    const prepared = this.ready;
    if (!prepared) throw new AppUpdateException('no_update', 'APK hali tayyor emas');
    try { return await this.service.installPreparedUpdate(prepared); }
    catch (error) {
      if (error instanceof AppUpdateException && error.code === 'prepared_apk_missing') { this.ready = null; this.accept(prepared.update); }
      throw error;
    }
  }
  private promptReady(): void {
    const prepared = this.ready, presenter = this.presenter;
    if (this.disposed || !prepared?.update.manifest || !presenter || !this.foreground || this.dialogOpen) return;
    const key = prepared.update.manifest.artifactKey;
    if (this.manualOpen) { this.shownOptionalArtifact = key; return; }
    if (!prepared.update.mandatory && this.shownOptionalArtifact === key) return;
    this.shownOptionalArtifact = key; this.dialogOpen = true;
    void presenter.showReady(this).finally(() => { this.dialogOpen = false; this.promptReady(); });
  }
  private isCurrent(scope: number): boolean { return !this.disposed && scope === this.scope && this.endpoint === this.endpointKey; }
  dispose(): void { this.disposed = true; this.preparation?.cancel(); this.listeners.clear(); }
}
