import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminWarehouseLiveCallbacks, AdminWarehouseLiveConnection } from './adminWarehouseLiveTransport';

export type AdminWarehouseLiveDependencies = {
  isCurrent: () => boolean; warehouseScoped: boolean;
  connect: (callbacks: AdminWarehouseLiveCallbacks) => AdminWarehouseLiveConnection;
  refresh: () => Promise<void>;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
};

/** @v2 _connectWarehouseLive, _scheduleWarehouseRefresh, _refreshInPlace, _scheduleWarehouseLiveReconnect */
export class AdminWarehouseLiveController {
  private active = false;
  private retired = false;
  private lifetime = 0;
  private connectionVersion = 0;
  private connection: AdminWarehouseLiveConnection | null = null;
  private refreshTimer: unknown = null;
  private reconnectTimer: unknown = null;
  private pendingRefresh = false;
  private refreshing = false;
  constructor(private readonly deps: AdminWarehouseLiveDependencies) {}
  private current(lifetime = this.lifetime): boolean {
    if (!this.active || this.retired || lifetime !== this.lifetime) return false;
    if (!isSynchronouslyTrue(this.deps.isCurrent)) { this.retired = true; this.dispose(); return false; }
    return this.active && !this.retired && lifetime === this.lifetime;
  }
  private schedule(callback: () => void, delay: number) { return (this.deps.schedule ?? setTimeout)(callback, delay); }
  private cancel(timer: 'refreshTimer' | 'reconnectTimer') {
    const value = this[timer]; this[timer] = null;
    if (value !== null) (this.deps.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>)))(value);
  }
  start(): void {
    if (this.active || this.retired) return;
    this.active = true; this.lifetime++;
    if (this.current() && !this.deps.warehouseScoped) this.connect();
  }
  private connect(): void {
    if (!this.current() || this.deps.warehouseScoped) return;
    const lifetime = this.lifetime, version = ++this.connectionVersion;
    this.connection?.stop(); this.connection = null;
    const valid = () => version === this.connectionVersion && this.current(lifetime);
    const reconnect = () => { if (valid()) this.reconnect(); };
    try {
      const connection = this.deps.connect({ message: value => { if (valid() && value.event === 'warehouse.updated') this.requestRefresh(); }, error: reconnect, done: reconnect });
      if (valid()) this.connection = connection; else connection.stop();
    } catch { reconnect(); }
  }
  private reconnect(): void {
    if (!this.current() || this.reconnectTimer !== null) return;
    this.connectionVersion++;
    const connection = this.connection; this.connection = null; connection?.stop();
    const lifetime = this.lifetime;
    this.reconnectTimer = this.schedule(() => {
      this.reconnectTimer = null;
      if (this.current(lifetime)) this.connect();
    }, 5000);
  }
  private requestRefresh(): void {
    if (!this.current()) return;
    this.pendingRefresh = true; this.cancel('refreshTimer');
    const lifetime = this.lifetime;
    this.refreshTimer = this.schedule(() => {
      this.refreshTimer = null;
      if (this.current(lifetime)) void this.refresh(lifetime);
    }, 250);
  }
  private async refresh(lifetime: number): Promise<void> {
    if (!this.current(lifetime) || this.refreshing) return;
    this.refreshing = true;
    try {
      while (this.pendingRefresh && this.current(lifetime)) {
        this.pendingRefresh = false; this.cancel('refreshTimer');
        try { await this.deps.refresh(); } catch { /* Source's FutureBuilder owns the actual refresh error. */ }
      }
    } finally { if (lifetime === this.lifetime) this.refreshing = false; }
  }
  dispose(): void {
    this.active = false; this.lifetime++; this.connectionVersion++;
    this.cancel('refreshTimer'); this.cancel('reconnectTimer'); this.pendingRefresh = false; this.refreshing = false;
    const connection = this.connection; this.connection = null; connection?.stop();
  }
}
