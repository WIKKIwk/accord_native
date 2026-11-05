import type { AppUpdateCoordinator, AppUpdatePresenter } from './appUpdateCoordinator';

type RuntimeOptions = { checkDelayMs?: number; fallbackIntervalMs?: number; reconnectDelayMs?: number };

/** @v2 AppUpdateRuntime */
export class AppUpdateRuntime {
  private checkTimer: ReturnType<typeof setTimeout> | undefined;
  private fallbackTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: (() => void) | null = null;
  private watchEndpoint: string | null = null;
  private watchRevision = 0;
  private running = false;
  constructor(private readonly coordinator: AppUpdateCoordinator, private readonly presenter: AppUpdatePresenter,
    private readonly options: RuntimeOptions = {}) {}
  start(): void {
    if (this.running) return;
    this.running = true; this.coordinator.setForeground(true);
    this.checkForUpdate();
    this.fallbackTimer = setInterval(() => this.checkForUpdate(), this.options.fallbackIntervalMs ?? 30_000);
  }
  sessionChanged(): void {
    if (!this.running) return;
    if (this.checkTimer !== undefined) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => { this.checkTimer = undefined; this.checkForUpdate(); }, this.options.checkDelayMs ?? 300);
  }
  setForeground(foreground: boolean): void {
    this.coordinator.setForeground(foreground);
    if (foreground) this.sessionChanged();
  }
  private watchReleases(): void {
    if (!this.coordinator.isSupported) return;
    const endpoint = this.coordinator.endpointKey;
    if (this.unsubscribe && this.watchEndpoint === endpoint) return;
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const revision = ++this.watchRevision;
    this.unsubscribe?.(); this.unsubscribe = null; this.watchEndpoint = endpoint;
    let ended = false;
    const reconnect = () => {
      if (ended || revision !== this.watchRevision) return;
      ended = true;
      this.unsubscribe = null;
      if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
      if (this.running) this.reconnectTimer = setTimeout(() => { this.reconnectTimer = undefined; this.watchReleases(); }, this.options.reconnectDelayMs ?? 3000);
    };
    try {
      const unsubscribe = this.coordinator.releaseChanges(() => {
        if (!ended && revision === this.watchRevision) this.checkForUpdate();
      }, reconnect);
      if (ended || revision !== this.watchRevision || !this.running) unsubscribe();
      else this.unsubscribe = unsubscribe;
    }
    catch { reconnect(); }
  }
  private checkForUpdate(): void {
    if (!this.running) return;
    this.watchReleases();
    void this.coordinator.checkAndPrompt(this.presenter, false).catch(() => {});
  }
  dispose(): void {
    if (!this.running) return;
    this.running = false;
    this.watchRevision++;
    if (this.checkTimer !== undefined) clearTimeout(this.checkTimer);
    if (this.fallbackTimer !== undefined) clearInterval(this.fallbackTimer);
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.unsubscribe?.(); this.unsubscribe = null; this.watchEndpoint = null;
    this.checkTimer = undefined; this.fallbackTimer = undefined; this.reconnectTimer = undefined;
    this.coordinator.setForeground(false);
  }
}
