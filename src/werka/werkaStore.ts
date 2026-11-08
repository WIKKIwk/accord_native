import { currentSession, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { WerkaRuntimeStore, type WerkaSummary } from '../shared/dispatchRuntimeStores';
import type { DispatchRecord } from '../shared/notificationApi';
import { werkaPendingBreakdown, werkaPendingDetailItems } from './werkaPendingLogic';
import type { WerkaStatusBreakdownEntry, WerkaStatusKind } from './werkaRecordApi';

export type WerkaHome = { summary: WerkaSummary; pendingItems: DispatchRecord[] };
export type WerkaStoreApi = {
  home: (session: Session) => Promise<WerkaHome>;
  pending: (session: Session) => Promise<DispatchRecord[]>;
  history: (session: Session) => Promise<DispatchRecord[]>;
  breakdown: (session: Session, kind: WerkaStatusKind) => Promise<WerkaStatusBreakdownEntry[]>;
  details: (session: Session, kind: WerkaStatusKind, supplierRef: string) => Promise<DispatchRecord[]>;
};
type State = {
  loadingHome: boolean; loadingPending: boolean; loadingHistory: boolean;
  loadedHome: boolean; loadedPending: boolean; loadedHistory: boolean;
  homeError: unknown | null; pendingError: unknown | null; historyError: unknown | null;
  summary: WerkaSummary; pendingItems: DispatchRecord[]; fullPendingItems: DispatchRecord[]; historyItems: DispatchRecord[];
  loadingBreakdown: Record<string, boolean>; breakdownErrors: Record<string, unknown>; breakdownItems: Record<string, WerkaStatusBreakdownEntry[]>;
  loadingDetail: Record<string, boolean>; detailErrors: Record<string, unknown>; detailItems: Record<string, DispatchRecord[]>;
  homePendingListExpanded: boolean;
};
function initialState(expanded = true): State {
  return { loadingHome: false, loadingPending: false, loadingHistory: false, loadedHome: false, loadedPending: false,
    loadedHistory: false, homeError: null, pendingError: null, historyError: null,
    summary: { pendingCount: 0, confirmedCount: 0, returnedCount: 0 }, pendingItems: [], fullPendingItems: [], historyItems: [],
    loadingBreakdown: {}, breakdownErrors: {}, breakdownItems: {}, loadingDetail: {}, detailErrors: {}, detailItems: {},
    homePendingListExpanded: expanded };
}
const detailKey = (kind: WerkaStatusKind, ref: string) => `${kind}:${ref.trim()}`;

/** Account-scoped implementation of the V2 WerkaStore read and projection behavior. */
export class WerkaStore {
  private state = initialState();
  private readonly emptyState = initialState();
  private readonly listeners = new Set<() => void>();
  private readonly runtime = new WerkaRuntimeStore();
  private readonly stopRuntime: () => void;
  private session: Session | null = null;
  private scope: string | null = null;
  private generation = 0;
  private disposed = false;

  constructor(private readonly api: WerkaStoreApi, session: Session | null = null,
    private readonly isActiveSession: (session: Session) => boolean = candidate => currentSession() === candidate) {
    this.stopRuntime = this.runtime.subscribe(() => this.update({}));
    this.setSession(session);
  }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = (): Readonly<State> => this.visible() ? this.state : this.emptyState;
  captureGeneration(): number { return this.generation; }
  private visible(): boolean {
    return !this.disposed && this.session !== null && this.isActiveSession(this.session) && sessionReadScope(this.session) === this.scope;
  }
  private current(generation: number): boolean {
    if (this.disposed || !this.session || generation !== this.generation) return false;
    if (!this.isActiveSession(this.session)) {
      this.setSession(null);
      return false;
    }
    if (sessionReadScope(this.session) !== this.scope) {
      this.setSession(this.session);
      return false;
    }
    return true;
  }
  private update(patch: Partial<State>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  private updateWithoutNotification(patch: Partial<State>): void { this.state = { ...this.state, ...patch }; }

  /** A replacement session or changed read scope invalidates old reads; an in-place token refresh does not. */
  setSession(session: Session | null): void {
    if (this.disposed) return;
    const accepted = session && this.isActiveSession(session) ? session : null;
    const scope = accepted ? sessionReadScope(accepted) : null;
    const changed = accepted !== this.session || scope !== this.scope;
    this.session = accepted;
    if (!changed) return;
    this.scope = scope; this.generation++;
    this.state = initialState(this.state.homePendingListExpanded);
    this.runtime.clear();
  }
  dispose(): void {
    this.generation++; this.session = null; this.scope = null; this.stopRuntime(); this.runtime.clear();
    this.state = initialState(this.state.homePendingListExpanded); this.disposed = true; this.listeners.clear();
  }

  getSummary(): WerkaSummary { return this.visible() ? this.runtime.applySummary(this.state.summary) : { ...this.emptyState.summary }; }
  getPendingItems(): DispatchRecord[] { return this.visible() ? this.runtime.applyPendingItems(this.state.pendingItems) : []; }
  getFullPendingItems(): DispatchRecord[] {
    return this.visible() ? this.runtime.applyPendingItems(this.state.loadedPending ? this.state.fullPendingItems : this.state.pendingItems) : [];
  }
  setHomePendingListExpanded(value: boolean, generation: number): boolean {
    if (!this.current(generation)) return false;
    this.state = { ...this.state, homePendingListExpanded: value }; return true;
  }
  getBreakdownItems(kind: WerkaStatusKind): WerkaStatusBreakdownEntry[] {
    if (!this.visible()) return [];
    return kind === 'pending' ? werkaPendingBreakdown(this.getFullPendingItems()) : this.state.breakdownItems[kind] ?? [];
  }
  isLoadingBreakdown(kind: WerkaStatusKind): boolean {
    if (!this.visible()) return false;
    return kind === 'pending' ? this.state.loadingPending : this.state.loadingBreakdown[kind] === true;
  }
  getBreakdownError(kind: WerkaStatusKind): unknown | null {
    if (!this.visible()) return null;
    return kind === 'pending' ? this.state.pendingError : this.state.breakdownErrors[kind] ?? null;
  }
  getDetailItems(kind: WerkaStatusKind, ref: string): DispatchRecord[] {
    if (!this.visible()) return [];
    return kind === 'pending' ? werkaPendingDetailItems(this.getFullPendingItems(), ref) : this.state.detailItems[detailKey(kind, ref)] ?? [];
  }
  isLoadingDetail(kind: WerkaStatusKind, ref: string): boolean {
    if (!this.visible()) return false;
    return kind === 'pending' ? this.state.loadingPending : this.state.loadingDetail[detailKey(kind, ref)] === true;
  }
  getDetailError(kind: WerkaStatusKind, ref: string): unknown | null {
    if (!this.visible()) return null;
    return kind === 'pending' ? this.state.pendingError : this.state.detailErrors[detailKey(kind, ref)] ?? null;
  }

  async bootstrapHome(force = false, bootstrap?: { generation: number; value: WerkaHome } | null): Promise<void> {
    if (!this.current(this.generation) || this.state.loadingHome || (this.state.loadedHome && !force)) return;
    if (!force && bootstrap && this.current(bootstrap.generation)) {
      this.update({ summary: bootstrap.value.summary, pendingItems: bootstrap.value.pendingItems, loadedHome: true, homeError: null });
      return;
    }
    await this.refreshHome();
  }
  async refreshHome(): Promise<void> {
    const session = this.session, generation = this.generation;
    if (!session || !this.current(generation) || this.state.loadingHome) return;
    this.update({ loadingHome: true, homeError: null });
    try {
      const home = await this.api.home(session);
      if (!this.current(generation)) return;
      this.runtime.reconcileWithServer(this.state.loadedPending ? this.state.fullPendingItems : home.pendingItems, this.state.historyItems);
      this.updateWithoutNotification({ summary: home.summary, pendingItems: home.pendingItems, loadedHome: true });
    } catch (error) { if (this.current(generation)) this.updateWithoutNotification({ homeError: error }); }
    finally { if (this.current(generation)) this.update({ loadingHome: false }); }
  }
  async bootstrapPending(force = false): Promise<void> {
    if (!this.current(this.generation) || this.state.loadingPending || (this.state.loadedPending && !force)) return;
    await this.refreshPending();
  }
  async refreshPending(): Promise<void> {
    const session = this.session, generation = this.generation;
    if (!session || !this.current(generation) || this.state.loadingPending) return;
    this.update({ loadingPending: true, pendingError: null });
    try {
      const items = await this.api.pending(session);
      if (!this.current(generation)) return;
      this.runtime.reconcileWithServer(items, this.state.historyItems);
      this.updateWithoutNotification({ fullPendingItems: items, summary: { ...this.state.summary, pendingCount: items.length }, loadedPending: true });
    } catch (error) { if (this.current(generation)) this.updateWithoutNotification({ pendingError: error }); }
    finally { if (this.current(generation)) this.update({ loadingPending: false }); }
  }
  async bootstrapHistory(force = false): Promise<void> {
    if (!this.current(this.generation) || this.state.loadingHistory || (this.state.loadedHistory && !force)) return;
    await this.refreshHistory();
  }
  async refreshHistory(): Promise<void> {
    const session = this.session, generation = this.generation;
    if (!session || !this.current(generation) || this.state.loadingHistory) return;
    this.update({ loadingHistory: true, historyError: null });
    try {
      const items = await this.api.history(session);
      if (!this.current(generation)) return;
      this.runtime.reconcileWithServer(this.state.loadedPending ? this.state.fullPendingItems : this.state.pendingItems, items);
      this.updateWithoutNotification({ historyItems: items, loadedHistory: true });
    } catch (error) { if (this.current(generation)) this.updateWithoutNotification({ historyError: error }); }
    finally { if (this.current(generation)) this.update({ loadingHistory: false }); }
  }
  async refreshAll(): Promise<void> { await Promise.all([this.refreshHome(), this.refreshPending(), this.refreshHistory()]); }

  async bootstrapBreakdown(kind: WerkaStatusKind, force = false): Promise<void> {
    if (kind === 'pending') return this.bootstrapPending(force);
    if (!this.current(this.generation) || this.isLoadingBreakdown(kind) || (!force && Object.hasOwn(this.state.breakdownItems, kind))) return;
    await this.refreshBreakdown(kind);
  }
  async refreshBreakdown(kind: WerkaStatusKind): Promise<void> {
    if (kind === 'pending') return this.refreshPending();
    const session = this.session, generation = this.generation;
    if (!session || !this.current(generation) || this.isLoadingBreakdown(kind)) return;
    this.update({ loadingBreakdown: { ...this.state.loadingBreakdown, [kind]: true }, breakdownErrors: { ...this.state.breakdownErrors, [kind]: null } });
    try {
      const items = await this.api.breakdown(session, kind);
      if (this.current(generation)) this.updateWithoutNotification({ breakdownItems: { ...this.state.breakdownItems, [kind]: items } });
    } catch (error) {
      if (this.current(generation)) this.updateWithoutNotification({ breakdownErrors: { ...this.state.breakdownErrors, [kind]: error } });
    } finally {
      if (this.current(generation)) this.update({ loadingBreakdown: { ...this.state.loadingBreakdown, [kind]: false } });
    }
  }
  async bootstrapDetail(kind: WerkaStatusKind, ref: string, force = false): Promise<void> {
    if (kind === 'pending') return this.bootstrapPending(force);
    const key = detailKey(kind, ref);
    if (!this.current(this.generation) || this.isLoadingDetail(kind, ref) || (!force && Object.hasOwn(this.state.detailItems, key))) return;
    await this.refreshDetail(kind, ref);
  }
  async refreshDetail(kind: WerkaStatusKind, ref: string): Promise<void> {
    if (kind === 'pending') return this.refreshPending();
    const session = this.session, generation = this.generation, key = detailKey(kind, ref);
    if (!session || !this.current(generation) || this.isLoadingDetail(kind, ref)) return;
    this.update({ loadingDetail: { ...this.state.loadingDetail, [key]: true }, detailErrors: { ...this.state.detailErrors, [key]: null } });
    try {
      const items = await this.api.details(session, kind, ref);
      if (this.current(generation)) this.updateWithoutNotification({ detailItems: { ...this.state.detailItems, [key]: items } });
    } catch (error) {
      if (this.current(generation)) this.updateWithoutNotification({ detailErrors: { ...this.state.detailErrors, [key]: error } });
    } finally {
      if (this.current(generation)) this.update({ loadingDetail: { ...this.state.loadingDetail, [key]: false } });
    }
  }

  /** False means this result belongs to an old session, not that the server write was cancelled. */
  recordCreatedPending(record: DispatchRecord, generation: number): boolean {
    if (!this.current(generation)) return false;
    this.runtime.recordCreatedPending(record); return true;
  }
  recordTransition(before: DispatchRecord, after: DispatchRecord, generation: number): boolean {
    if (!this.current(generation)) return false;
    this.runtime.recordTransition(before, after); return true;
  }
}
