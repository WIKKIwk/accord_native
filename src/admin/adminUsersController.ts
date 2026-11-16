import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminUserListOptions } from './adminUsersApi';
import { AdminUsersCache } from './adminUsersCache';
import { adminUserDetailRoute, adminUserKindRoleQuery, adminUserKinds, adminUserMatchesSearch, adminUsersVisibleItems,
  type AdminRoleAssignment, type AdminUserKind, type AdminUserListEntry, type AdminUserListPage } from './adminUsersModel';
import { AdminUsersRoleStore } from './adminUsersRoleStore';
import { dartTrim } from './dartJsonString';

export type AdminUsersNotice = Readonly<{ key: 'users.next_page_failed'; serial: number }>;
export type AdminUsersSnapshot = Readonly<{ screen: 'unselected' | 'loading' | 'content' | 'error' | 'forbidden';
  query: string; selectedKind: AdminUserKind | null; roleMenuOpen: boolean; items: readonly AdminUserListEntry[];
  assignments: readonly AdminRoleAssignment[]; exitingItems: readonly AdminUserListEntry[]; enteringIds: readonly string[];
  initialLoading: boolean; loadingMore: boolean; hasMore: boolean; offset: number; loadError: boolean;
  notice: AdminUsersNotice | null; scrollResetSerial: number }>;
export type AdminUsersDetailTicket = Readonly<{ routeName: string; item: AdminUserListEntry }>;
export type AdminUsersDependencies = {
  isCurrent: () => boolean; scope: () => string; revision: () => number; profileRef: string; salesManager: boolean;
  roles: AdminUsersRoleStore; cache: AdminUsersCache;
  readPage: (options: AdminUserListOptions, guard: () => void, readWitness: () => boolean) => Promise<AdminUserListPage>;
  readAssignments: (guard: () => void, readWitness: () => boolean) => Promise<readonly AdminRoleAssignment[]>;
  schedule?: (callback: () => void, delay: number) => unknown; cancel?: (handle: unknown) => void;
};
type Request = Readonly<{ generation: number; lifetime: number; query: string; kind: AdminUserKind | null }>;
const emptyPage: AdminUserListPage = Object.freeze({ items: Object.freeze([]), has_more: false });
function initial(kind: AdminUserKind | null): AdminUsersSnapshot {
  return Object.freeze({ screen: kind === null ? 'unselected' : 'loading', query: '', selectedKind: kind, roleMenuOpen: false,
    items: Object.freeze([]), assignments: Object.freeze([]), exitingItems: Object.freeze([]), enteringIds: Object.freeze([]),
    initialLoading: true, loadingMore: false, hasMore: true, offset: 0, loadError: false, notice: null, scrollResetSerial: 0 });
}

/** @v2 _AdminSuppliersScreenState and its two method parts. No UI or backend mutations are owned here. */
export class AdminUsersController {
  private state: AdminUsersSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly detailTickets = new WeakMap<AdminUsersDetailTicket, number>();
  private alive = false;
  private retired = false;
  private lifetime = 0;
  private scope = '';
  private revision = 0;
  private requestGeneration = 0;
  private animationGeneration = 0;
  private noticeSerial = 0;
  private authoritativeItems: readonly AdminUserListEntry[] = [];
  private authoritativeQuery = '';
  private animateNextListUpdate = false;
  private manuallySelectedRole = false;
  private searchTimer: unknown = null;
  private animationTimer: unknown = null;
  private unsubscribeCache: (() => void) | null = null;
  constructor(private readonly deps: AdminUsersDependencies) {
    this.state = initial(deps.salesManager ? 'customer' : deps.roles.cachedRole);
  }
  getSnapshot = (): AdminUsersSnapshot => this.state;
  interactionGeneration = (): number => this.lifetime;
  isInteractionCurrent = (generation: number): boolean => this.current(generation);
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(value: Partial<AdminUsersSnapshot>): void {
    if (!this.alive) return;
    const next = { ...this.state, ...value };
    if (next.screen !== 'forbidden') next.screen = next.selectedKind === null ? 'unselected' : next.loadError ? 'error' : next.initialLoading ? 'loading' : 'content';
    this.state = Object.freeze(next);
    for (const listener of [...this.listeners]) listener();
  }
  private cancel(timer: 'searchTimer' | 'animationTimer'): void {
    const handle = this[timer]; this[timer] = null;
    if (handle !== null) (this.deps.cancel ?? (id => clearTimeout(id as ReturnType<typeof setTimeout>)))(handle);
  }
  private schedule(callback: () => void, delay: number): unknown { return (this.deps.schedule ?? setTimeout)(callback, delay); }
  private current(lifetime = this.lifetime): boolean {
    if (!this.alive || this.retired || lifetime !== this.lifetime) return false;
    if (!isSynchronouslyTrue(this.deps.isCurrent) || this.deps.scope() !== this.scope || this.deps.revision() !== this.revision) {
      this.invalidate(); return false;
    }
    return true;
  }
  private request(): Request { return { generation: this.requestGeneration, lifetime: this.lifetime, query: this.state.query, kind: this.state.selectedKind }; }
  private valid(request: Request): boolean {
    return this.current(request.lifetime) && request.generation === this.requestGeneration && request.query === this.state.query && request.kind === this.state.selectedKind;
  }
  private guard(request: Request): () => void { return () => { if (!this.valid(request)) throw new Error('Admin users request changed'); }; }
  private readWitness(guard: () => void): () => boolean { return () => { try { guard(); return true; } catch { return false; } }; }
  start(): void {
    if (this.retired || this.alive) return;
    this.alive = true; this.lifetime++; this.scope = this.deps.scope(); this.revision = this.deps.revision();
    this.manuallySelectedRole = false;
    this.state = initial(this.deps.salesManager ? 'customer' : this.deps.roles.cachedRole);
    if (!this.current()) return;
    this.unsubscribeCache = this.deps.cache.subscribe(() => { if (this.current()) { this.animateNextListUpdate = false; void this.bootstrap(true); } });
    void this.bootstrap();
    if (!this.deps.salesManager) void this.restoreRole(this.lifetime);
  }
  private async restoreRole(lifetime: number): Promise<void> {
    const guard = () => { if (!this.current(lifetime)) throw new Error('Admin users selection changed'); };
    try {
      const saved = await this.deps.roles.loadSavedRole(this.deps.profileRef, guard);
      if (this.current(lifetime) && !this.manuallySelectedRole && saved !== null && this.state.selectedKind !== saved) this.selectKind(saved);
    } catch { /* Expired storage completion must not affect this or a later mounted screen. */ }
  }
  dispose(): void {
    this.alive = false; this.lifetime++; this.requestGeneration++; this.animationGeneration++;
    this.cancel('searchTimer'); this.cancel('animationTimer'); this.unsubscribeCache?.(); this.unsubscribeCache = null;
  }
  invalidate(): void {
    if (this.retired) return;
    this.retired = true; this.requestGeneration++; this.animationGeneration++;
    this.cancel('searchTimer'); this.cancel('animationTimer'); this.unsubscribeCache?.(); this.unsubscribeCache = null;
    this.authoritativeItems = []; this.authoritativeQuery = '';
    this.patch({ ...initial(null), screen: 'forbidden' });
  }
  private page(request: Request, offset: number): Promise<AdminUserListPage> {
    if (request.kind === null) return Promise.resolve(emptyPage);
    const guard = this.guard(request);
    // _adminUserKindUsesWorkers is always false: even workers use the unified users endpoint.
    return this.deps.readPage({ query: request.query, limit: 50, offset, role: adminUserKindRoleQuery(request.kind) }, guard, this.readWitness(guard));
  }
  private async bootstrap(forceRefresh = false, showLoading = true): Promise<void> {
    if (!this.current()) return;
    this.requestGeneration++;
    if (!forceRefresh) {
      const cached = this.deps.cache.read(this.scope, this.revision);
      if (cached && this.current()) {
        this.authoritativeItems = cached.items; this.authoritativeQuery = cached.query;
        this.patch({ items: cached.items, assignments: cached.assignments, query: cached.query,
          selectedKind: cached.selectedKind ?? this.deps.roles.cachedRole, hasMore: cached.has_more, offset: cached.offset,
          initialLoading: false, loadingMore: false, loadError: false });
        return;
      }
    }
    const request = this.request(), guard = this.guard(request);
    this.patch({ ...(showLoading ? { initialLoading: true } : {}), loadingMore: false, loadError: false });
    if (!this.valid(request)) return;
    try {
      const [page, assignments] = await Promise.all([this.page(request, 0), this.deps.salesManager || request.kind === 'worker'
        ? Promise.resolve([]) : this.deps.readAssignments(guard, this.readWitness(guard))]);
      if (!this.valid(request)) return;
      this.applyResult(page, assignments, request);
      if (this.valid(request)) this.saveCache(request);
    } catch {
      if (this.valid(request)) {
        this.animateNextListUpdate = false;
        this.patch({ initialLoading: false, loadingMore: false, ...(showLoading ? { loadError: true } : {}) });
      }
    }
  }
  private saveCache(request: Request): void {
    this.deps.cache.save({ readScope: this.scope, revision: this.revision, items: this.state.items, assignments: this.state.assignments,
      has_more: this.state.hasMore, offset: this.state.offset, query: this.state.query, selectedKind: this.state.selectedKind }, this.guard(request));
  }
  private clearAnimationsAfterDelay(enteringIds: readonly string[], generation: number): void {
    const lifetime = this.lifetime;
    if (!this.current(lifetime) || this.animationGeneration !== generation) return;
    this.cancel('animationTimer');
    this.animationTimer = this.schedule(() => {
      this.animationTimer = null;
      if (!this.current(lifetime) || generation !== this.animationGeneration) return;
      this.patch({ exitingItems: Object.freeze([]), enteringIds: Object.freeze(this.state.enteringIds.filter(id => !enteringIds.includes(id))) });
    }, 180);
  }
  private applyResult(page: AdminUserListPage, assignments: readonly AdminRoleAssignment[], request: Request): void {
    const previousIds = new Set(this.state.items.map(item => item.id)), nextIds = new Set(page.items.map(item => item.id));
    const exiting = new Map(this.state.exitingItems.map(item => [item.id, item]));
    if (this.animateNextListUpdate) for (const item of this.state.items) if (!nextIds.has(item.id)) exiting.set(item.id, item);
    for (const id of nextIds) exiting.delete(id);
    const entering = this.animateNextListUpdate ? page.items.filter(item => !previousIds.has(item.id)).map(item => item.id) : [];
    this.animateNextListUpdate = false; const generation = ++this.animationGeneration;
    this.authoritativeQuery = this.state.query; this.authoritativeItems = page.items;
    this.patch({ items: Object.freeze([...page.items]), assignments: Object.freeze([...assignments]), exitingItems: Object.freeze([...exiting.values()]),
      enteringIds: Object.freeze(entering), hasMore: page.has_more, offset: page.items.length, initialLoading: false, loadingMore: false, loadError: false });
    if (this.valid(request) && (exiting.size || entering.length)) this.clearAnimationsAfterDelay(entering, generation);
  }
  refresh = async (): Promise<void> => { this.animateNextListUpdate = false; await this.bootstrap(true); };
  toggleRoleMenu(): void { if (this.current() && !this.deps.salesManager) this.patch({ roleMenuOpen: !this.state.roleMenuOpen }); }
  selectKind(kind: AdminUserKind): void {
    if (!this.current() || !adminUserKinds.includes(kind) || (this.deps.salesManager && kind !== 'customer')) return;
    this.manuallySelectedRole = true;
    const lifetime = this.lifetime;
    void this.deps.roles.saveRole(kind, this.deps.profileRef, () => { if (!this.current(lifetime)) throw new Error('Admin users selection changed'); }).catch(() => {});
    if (this.state.selectedKind === kind) { this.patch({ roleMenuOpen: false }); return; }
    const generation = ++this.requestGeneration; this.animationGeneration++; this.animateNextListUpdate = false;
    this.authoritativeItems = []; this.authoritativeQuery = '';
    this.patch({ selectedKind: kind, exitingItems: Object.freeze([]), enteringIds: Object.freeze([]), roleMenuOpen: false,
      initialLoading: true, loadingMore: false, loadError: false, scrollResetSerial: this.state.scrollResetSerial + 1 });
    if (this.current(lifetime) && this.requestGeneration === generation && this.state.selectedKind === kind) void this.bootstrap(true);
  }
  setSearch(value: string): void {
    if (!this.current()) return;
    this.cancel('searchTimer'); const query = dartTrim(value);
    if (query === this.state.query) return;
    const requestGeneration = ++this.requestGeneration, animationGeneration = ++this.animationGeneration; this.animateNextListUpdate = true;
    const local = this.state.selectedKind !== null && this.authoritativeItems.length > 0 && query.startsWith(this.authoritativeQuery);
    const nextItems = local ? this.authoritativeItems.filter(item => adminUserMatchesSearch(item, query)) : this.state.items;
    const nextIds = new Set(nextItems.map(item => item.id));
    const exiting = local ? this.state.items.filter(item => !nextIds.has(item.id)) : [];
    this.patch({ query, initialLoading: !local, loadingMore: false, loadError: false, items: Object.freeze([...nextItems]),
      exitingItems: Object.freeze(exiting), enteringIds: Object.freeze([]), scrollResetSerial: this.state.scrollResetSerial + 1 });
    if (!this.current() || this.requestGeneration !== requestGeneration || this.state.query !== query) return;
    if (exiting.length) this.clearAnimationsAfterDelay([], animationGeneration);
    const lifetime = this.lifetime;
    this.searchTimer = this.schedule(() => {
      this.searchTimer = null;
      if (this.current(lifetime) && this.state.query === query) void this.bootstrap(true, !local);
    }, 220);
  }
  async loadMore(): Promise<void> {
    if (!this.current() || this.state.selectedKind === null || this.state.loadingMore || this.state.initialLoading || !this.state.hasMore) return;
    const request = this.request(), offset = this.state.offset;
    this.patch({ loadingMore: true }); if (!this.valid(request)) return;
    try {
      const page = await this.page(request, offset);
      if (!this.valid(request) || this.state.offset !== offset) return;
      this.authoritativeItems = Object.freeze([...this.authoritativeItems, ...page.items]);
      this.patch({ items: Object.freeze([...this.state.items, ...page.items]), offset: offset + page.items.length, hasMore: page.has_more });
      if (this.valid(request)) this.saveCache(request);
    } catch {
      if (this.valid(request)) this.patch({ notice: Object.freeze({ key: 'users.next_page_failed', serial: ++this.noticeSerial }) });
    } finally { if (this.valid(request)) this.patch({ loadingMore: false }); }
  }
  handleScrollMetrics(viewportDimension: number, extentAfter: number): void {
    if (!this.state.initialLoading && !this.state.loadingMore && this.state.selectedKind !== null && this.state.hasMore && extentAfter < viewportDimension * 2.5) void this.loadMore();
  }
  dismissNotice(serial: number): void { if (this.current() && this.state.notice?.serial === serial) this.patch({ notice: null }); }
  visibleItems(locale: string): readonly AdminUserListEntry[] {
    return adminUsersVisibleItems([...this.state.items, ...this.state.exitingItems], this.state.assignments, this.state.selectedKind, locale);
  }
  captureDetail(id: string, locale: string): AdminUsersDetailTicket | null {
    if (!this.current() || this.state.initialLoading || this.state.loadError || this.state.exitingItems.some(item => item.id === id)) return null;
    const item = this.visibleItems(locale).find(item => item.id === id); if (!item) return null;
    const ticket = Object.freeze({ item, routeName: adminUserDetailRoute(item) }); this.detailTickets.set(ticket, this.lifetime); return ticket;
  }
  completeDetail(ticket: AdminUsersDetailTicket, changed: boolean): void {
    const lifetime = this.detailTickets.get(ticket); this.detailTickets.delete(ticket);
    if (lifetime !== undefined && changed === true && this.current(lifetime)) void this.bootstrap(true);
  }
}
