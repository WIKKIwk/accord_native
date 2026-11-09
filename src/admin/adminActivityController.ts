import type { DispatchRecord } from '../shared/notificationApi';
import { adminActivityClearIds, adminActivityShouldRefresh } from './adminActivityModel';
import type { AdminStore, AdminStoreSnapshot } from './adminStore';
import type { AdminHomeRefreshHub } from './adminHomeController';

type ActivityStore = Pick<AdminStore, 'getSnapshot' | 'subscribe' | 'bootstrapActivity' | 'refreshActivity'>;
type Guard = () => void;
/** The adapter must itself bind reads/writes to this witness and prevent stale persistent effects. */
export type SafeActivityHiddenStore = {
  load: (guard: Guard) => Promise<ReadonlySet<string>>;
  hideAll: (ids: readonly string[], guard: Guard) => Promise<ReadonlySet<string>>;
};
export type AdminActivityDependencies = { store: ActivityStore; hidden: SafeActivityHiddenStore; hub: AdminHomeRefreshHub;
  isCurrent: () => boolean; scope: () => string; generation: () => string | number | null; canOpen: () => boolean; afterFrame: () => Promise<void> };
export type AdminActivitySnapshot = { activity: AdminStoreSnapshot; hiddenIds: ReadonlySet<string>; hiddenState: 'loading' | 'ready' | 'error';
  confirmation: number | null; clearing: boolean; invalidated: boolean };

/** The role shell must supply a safe hidden adapter and a session/scope transition witness. */
export class AdminActivityController {
  private readonly listeners = new Set<() => void>();
  private readonly scope: string;
  private readonly generation: string | number | null;
  private state: AdminActivitySnapshot;
  private active = false;
  private epoch = 0;
  private hiddenSerial = 0;
  private confirmationSerial = 0;
  private refreshVersion = 0;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeHub: (() => void) | null = null;
  constructor(private readonly deps: AdminActivityDependencies) {
    this.scope = deps.scope(); this.generation = deps.generation();
    this.state = { activity: deps.store.getSnapshot(), hiddenIds: new Set(), hiddenState: 'loading', confirmation: null, clearing: false, invalidated: false };
  }
  getSnapshot = (): AdminActivitySnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private emit(patch: Partial<AdminActivitySnapshot>): void {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private valid(epoch = this.epoch): boolean {
    return this.active && !this.state.invalidated && epoch === this.epoch && this.generation !== null && this.deps.generation() === this.generation &&
      this.deps.isCurrent() && this.deps.scope() === this.scope && this.deps.canOpen();
  }
  private guard(epoch: number): Guard { return () => { if (!this.valid(epoch)) throw new Error('Admin activity session changed'); }; }
  private currentOrInvalidate(epoch: number): boolean {
    if (this.valid(epoch)) return true;
    if (this.active && epoch === this.epoch) this.invalidate();
    return false;
  }
  start(): void {
    if (this.active || this.state.invalidated) return;
    this.active = true; const epoch = ++this.epoch;
    this.state = { activity: this.deps.store.getSnapshot(), hiddenIds: new Set(), hiddenState: 'loading',
      confirmation: null, clearing: false, invalidated: false }; this.refreshVersion = 0;
    if (!this.currentOrInvalidate(epoch)) return;
    this.unsubscribeStore = this.deps.store.subscribe(() => {
      if (this.currentOrInvalidate(epoch)) this.emit({ activity: this.deps.store.getSnapshot() });
    });
    this.unsubscribeHub = this.deps.hub.subscribe(() => {
      if (!this.currentOrInvalidate(epoch) || !adminActivityShouldRefresh(this.deps.hub.topic, this.deps.hub.version, this.refreshVersion)) return;
      this.refreshVersion = this.deps.hub.version; void this.reload();
    });
    void this.deps.afterFrame().then(() => {
      if (!this.currentOrInvalidate(epoch)) return;
      void this.deps.store.bootstrapActivity(); void this.loadHidden(epoch);
    }, () => { if (this.currentOrInvalidate(epoch)) this.emit({ hiddenState: 'error' }); });
  }
  private async loadHidden(epoch: number): Promise<void> {
    if (!this.currentOrInvalidate(epoch)) return;
    const serial = ++this.hiddenSerial; this.emit({ hiddenState: 'loading' });
    try {
      const ids = await this.deps.hidden.load(this.guard(epoch));
      if (this.currentOrInvalidate(epoch) && serial === this.hiddenSerial) this.emit({ hiddenIds: new Set(ids), hiddenState: 'ready' });
    } catch {
      if (this.currentOrInvalidate(epoch) && serial === this.hiddenSerial) this.emit({ hiddenIds: new Set(), hiddenState: 'error' });
    }
  }
  async reload(): Promise<void> {
    const epoch = this.epoch;
    if (!this.currentOrInvalidate(epoch)) return;
    await Promise.all([this.deps.store.refreshActivity(), ...(this.state.hiddenState === 'error' ? [this.loadHidden(epoch)] : [])]);
    this.currentOrInvalidate(epoch);
  }
  requestClear(): number | null {
    if (!this.currentOrInvalidate(this.epoch) || this.state.clearing || this.state.confirmation !== null) return null;
    const serial = ++this.confirmationSerial; this.emit({ confirmation: serial }); return serial;
  }
  async resolveClear(serial: number, confirmed: boolean): Promise<void> {
    const epoch = this.epoch;
    if (!this.currentOrInvalidate(epoch) || this.state.confirmation !== serial) return;
    this.emit({ confirmation: null });
    if (!confirmed || !this.currentOrInvalidate(epoch)) return;
    const ids: readonly string[] = adminActivityClearIds(this.deps.store.getSnapshot().activityItems as readonly DispatchRecord[]);
    const operation = ++this.hiddenSerial; this.emit({ clearing: true });
    if (!this.currentOrInvalidate(epoch)) return;
    try {
      const hiddenIds = await this.deps.hidden.hideAll(ids, this.guard(epoch));
      if (this.currentOrInvalidate(epoch) && operation === this.hiddenSerial) this.emit({ hiddenIds: new Set(hiddenIds), hiddenState: 'ready', clearing: false });
    } catch {
      if (this.currentOrInvalidate(epoch) && operation === this.hiddenSerial) this.emit({ hiddenIds: new Set(), hiddenState: 'error', clearing: false });
    }
  }
  invalidate(): void {
    this.epoch++; this.hiddenSerial++;
    this.state = { ...this.state, activity: { ...this.state.activity, activityItems: [] }, hiddenIds: new Set(), hiddenState: 'loading',
      confirmation: null, clearing: false, invalidated: true };
    if (this.active) for (const listener of this.listeners) listener();
  }
  dispose(): void {
    this.active = false; this.epoch++; this.hiddenSerial++;
    this.unsubscribeStore?.(); this.unsubscribeStore = null; this.unsubscribeHub?.(); this.unsubscribeHub = null; this.listeners.clear();
  }
}
