import type { AdminStore } from './adminStore';

export type AdminHomeRefreshHub = { topic: string; version: number; subscribe: (listener: () => void) => () => void };
export type AdminHomeDependencies = {
  /** Store must belong to this exact session and read scope; its owner clears it on session changes. */
  store: Pick<AdminStore, 'bootstrapSummary' | 'refreshSummary'>;
  hub: AdminHomeRefreshHub;
  isCurrent: () => boolean;
  scope: () => string;
  canLoadSummary: () => boolean;
  canOpen: (route: string) => boolean;
  afterFrame: () => Promise<void>;
};

/** @v2 _AdminHomeScreenState */
export class AdminHomeController {
  private active = false;
  private epoch = 0;
  private openingId = 0;
  private opening = false;
  private refreshVersion = 0;
  private readonly scope: string;
  private unsubscribe: (() => void) | null = null;
  constructor(private readonly deps: AdminHomeDependencies) { this.scope = deps.scope(); }
  private valid(epoch = this.epoch): boolean {
    return this.active && epoch === this.epoch && this.deps.isCurrent() && this.deps.scope() === this.scope;
  }
  start(): void {
    if (this.active) return;
    this.active = true;
    const epoch = ++this.epoch;
    this.unsubscribe = this.deps.hub.subscribe(() => this.onRefreshEvent());
    void this.deps.afterFrame().then(() => {
      if (this.valid(epoch) && this.deps.canLoadSummary()) void this.deps.store.bootstrapSummary();
    });
  }
  dispose(): void {
    this.active = false; this.epoch++; this.openingId++; this.opening = false;
    this.unsubscribe?.(); this.unsubscribe = null;
  }
  private onRefreshEvent(): void {
    if (!this.valid() || this.deps.hub.topic !== 'admin' || this.deps.hub.version === this.refreshVersion) return;
    this.refreshVersion = this.deps.hub.version;
    void this.reload();
  }
  async reload(): Promise<void> {
    if (this.valid() && this.deps.canLoadSummary()) await this.deps.store.refreshSummary();
  }
  /** The supplied opener must resolve only when the destination actually closes. */
  async openAndReload(route: string, openRoute: (route: string) => Promise<void>): Promise<void> {
    if (!this.valid() || this.opening || !this.deps.canOpen(route)) return;
    this.opening = true;
    const epoch = this.epoch, openingId = ++this.openingId;
    try {
      await this.deps.afterFrame();
      if (!this.valid(epoch) || !this.deps.canOpen(route)) return;
      await openRoute(route);
      if (this.valid(epoch)) await this.reload();
    } finally {
      if (openingId === this.openingId) this.opening = false;
    }
  }
}
