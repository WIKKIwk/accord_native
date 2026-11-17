import { activeSessionEpoch, activeSessionToken, type Session } from '../../auth';
import { sessionReadScope } from '../../sessionReadScope';
import { appRoutes, canOpenRoute } from '../appRoutes';
import { isSynchronouslyTrue } from '../camera/synchronousGuard';
import { dartTrim } from '../dartApparatus';
import type { SupplyTaskKind, SupplyTaskWindow } from './supplyTaskModels';

export type SupplyTasksQuery = Readonly<{ kind: SupplyTaskKind; apparatus: string; limit: number; search: string }>;
export type SupplyTasksState = Readonly<{ query: SupplyTasksQuery; searchInput: string; window: SupplyTaskWindow | null;
  loading: boolean; error: unknown | null; active: boolean }>;
type TimerHandle = ReturnType<typeof setTimeout>;
type Dependencies = {
  session: Session;
  kind: SupplyTaskKind;
  initialApparatus?: string;
  isCurrent: () => boolean;
  /** The owner must supply a reviewed, authorized reader; no transport is installed by this controller. */
  loadWindow: (query: SupplyTasksQuery, isCurrent: () => boolean, fresh?: boolean) => Promise<SupplyTaskWindow>;
  loadSelection?: () => Promise<string | null>;
  saveSelection?: (id: string, window: SupplyTaskWindow) => void;
  events?: (baseline: SupplyTaskWindow, handlers: { next(window: SupplyTaskWindow): void; error(error: unknown): void; done(): void }) => () => void;
  remember?: (window: SupplyTaskWindow) => void;
  withdraw?: () => void;
  schedule?: (callback: () => void, milliseconds: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};
const empty = (kind: SupplyTaskKind, apparatus = ''): SupplyTasksState => Object.freeze({
  query: Object.freeze({ kind, apparatus, limit: 10, search: '' }), searchInput: '', window: null, loading: true, error: null, active: false,
});

/** @v2 _SupplyTasksScreenState: shared query state with opt-in live/cache dependencies. */
export class SupplyTasksController {
  private readonly session: Session;
  private readonly scope: string;
  private readonly epoch: number | null;
  private readonly isCurrent: () => boolean;
  private readonly loadWindow: Dependencies['loadWindow'];
  private readonly schedule: NonNullable<Dependencies['schedule']>;
  private readonly cancel: NonNullable<Dependencies['cancel']>;
  private readonly route: string;
  private state: SupplyTasksState;
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending: Promise<void> | null = null;
  private searchTimer: TimerHandle | null = null;
  private retiredEpochs = new Set<string>();
  private closed = false;
  private foreground = true;
  private socketGeneration = 0;
  private stopEvents: (() => void) | null = null;
  private firstMessage: TimerHandle | null = null;
  private reconnect: TimerHandle | null = null;
  private reconnectAttempt = 0;
  private repairBudget = 1;
  private readonly options: Dependencies;

  constructor(options: Dependencies) {
    this.options = options;
    if (options.kind !== 'material' && options.kind !== 'qolip') throw new TypeError('Invalid supply task kind');
    this.session = options.session; this.scope = sessionReadScope(options.session); this.epoch = activeSessionEpoch(options.session);
    this.isCurrent = options.isCurrent; this.loadWindow = options.loadWindow;
    this.schedule = options.schedule ?? setTimeout; this.cancel = options.cancel ?? clearTimeout;
    this.route = options.kind === 'material' ? appRoutes.materialTasks : appRoutes.qolipTasks;
    this.state = empty(options.kind, options.initialApparatus ?? '');
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  canInteract = () => this.current();
  private update(patch: Partial<SupplyTasksState>) {
    this.state = Object.freeze({ ...this.state, ...patch });
    this.listeners.forEach(listener => listener());
  }
  private current(generation = this.generation): boolean {
    try {
      const allowed = () => sessionReadScope(this.session) === this.scope && canOpenRoute(this.session, this.route);
      return !this.closed && this.state.active && generation === this.generation && this.epoch !== null &&
        activeSessionEpoch(this.session) === this.epoch && !!activeSessionToken(this.session) && allowed() && isSynchronouslyTrue(this.isCurrent) &&
        activeSessionEpoch(this.session) === this.epoch && !!activeSessionToken(this.session) && allowed() &&
        !this.closed && generation === this.generation;
    } catch { return false; }
  }
  activate(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.update({ active: true });
    if (!this.current()) { this.invalidate(); return Promise.resolve(); }
    if (this.options.loadSelection) return this.options.loadSelection().catch(() => null).then(apparatus => {
      if (!this.current()) return;
      if (apparatus) this.update({ query: Object.freeze({ ...this.state.query, apparatus }) });
      return this.refresh(false);
    });
    return this.refresh(false);
  }
  refresh(fresh = true): Promise<void> {
    if (!this.current()) return Promise.resolve();
    if (this.pending) return this.pending;
    this.stopLive();
    const generation = this.generation, query = this.state.query;
    const request = Promise.resolve().then(() => this.load(generation, query, fresh)).finally(() => {
      if (this.pending === request) {
        this.pending = null;
        if (this.current(generation) && this.state.window && !this.state.error) this.connect();
      }
    });
    this.pending = request;
    this.update({ error: null });
    return request;
  }
  private async load(generation: number, query: SupplyTasksQuery, fresh: boolean): Promise<void> {
    if (!this.current(generation)) return;
    try {
      const next = await this.loadWindow(query, () => this.current(generation), fresh);
      if (!this.current(generation)) return;
      const { kind, limit, search, epoch, apparatus_id: apparatus } = next;
      if (!this.current(generation)) return;
      if (kind !== query.kind || limit !== query.limit || search !== query.search || this.retiredEpochs.has(epoch)) {
        throw new TypeError('Mismatched or retired task window');
      }
      const previous = this.state.window;
      const previousEpoch = previous?.epoch;
      if (!this.current(generation)) return;
      if (previousEpoch && previousEpoch !== epoch) this.retiredEpochs.add(previousEpoch);
      this.update({ window: next, query: Object.freeze({ ...query, apparatus }), loading: false, error: null });
      this.options.remember?.(next);
    } catch (error) {
      if (!this.current(generation)) return;
      const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
      if (status === 401 || status === 403) this.options.withdraw?.();
      this.update({ loading: false, error, ...((status === 401 || status === 403) ? { window: null } : {}) });
    }
  }
  private changeQuery(patch: Partial<Pick<SupplyTasksQuery, 'apparatus' | 'limit' | 'search'>>): Promise<void> {
    if (!this.current()) return Promise.resolve();
    this.generation++; this.pending = null;
    this.stopLive(); this.repairBudget = 1;
    this.update({ query: Object.freeze({ ...this.state.query, ...patch }), loading: true });
    return this.refresh();
  }
  selectApparatus(id: string): Promise<void> {
    if (!this.current() || !this.state.window?.apparatus.some(item => item.id === id)) return Promise.resolve();
    this.options.saveSelection?.(id, this.state.window!);
    return this.changeQuery({ apparatus: id });
  }
  selectLimit(limit: number): Promise<void> {
    if (![5, 10, 20, 50].includes(limit)) return Promise.resolve();
    return this.changeQuery({ limit });
  }
  setSearchInput(value: string): boolean {
    if (!this.current() || typeof value !== 'string') return false;
    if (this.searchTimer !== null) { this.cancel(this.searchTimer); this.searchTimer = null; }
    this.update({ searchInput: value });
    this.searchTimer = this.schedule(() => {
      this.searchTimer = null;
      if (this.current()) void this.changeQuery({ search: dartTrim(value).toLowerCase() });
    }, 250);
    return true;
  }
  setForeground(value: boolean) {
    this.foreground = value;
    if (!value) this.stopLive();
    else if (this.current() && !this.pending) { if (this.state.window) this.connect(); else void this.refresh(); }
  }
  private stopLive() {
    this.socketGeneration++;
    if (this.firstMessage !== null) this.cancel(this.firstMessage);
    if (this.reconnect !== null) this.cancel(this.reconnect);
    this.firstMessage = this.reconnect = null;
    const stop = this.stopEvents; this.stopEvents = null; stop?.();
  }
  private connect() {
    if (!this.options.events || !this.current() || !this.foreground || !this.state.window) return;
    this.stopLive(); const generation = this.socketGeneration;
    const current = () => this.current() && this.foreground && generation === this.socketGeneration;
    const reconnect = () => {
      if (!current() || this.reconnect !== null) return;
      const stop = this.stopEvents; this.stopEvents = null; stop?.();
      if (this.firstMessage !== null) this.cancel(this.firstMessage); this.firstMessage = null;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt++, 5));
      this.reconnect = this.schedule(() => { this.reconnect = null; if (current()) this.connect(); }, delay);
    };
    const error = (reason: unknown) => {
      if (!current()) return;
      const value = reason as { code?: string; statusCode?: number };
      if (value?.statusCode === 401 || value?.statusCode === 403 || ['unauthorized', 'forbidden'].includes(value?.code ?? '')) {
        this.stopLive(); this.options.withdraw?.(); this.update({ window: null, error: reason }); return;
      }
      if (reason instanceof TypeError || ['supply_tasks_invalid', 'supply_tasks_resync'].includes(value?.code ?? '')) {
        this.stopLive();
        if (this.repairBudget > 0) { this.repairBudget--; void this.refresh(); }
        else this.update({ error: reason });
        return;
      }
      reconnect();
    };
    this.firstMessage = this.schedule(reconnect, 10_000);
    try {
      this.stopEvents = this.options.events(this.state.window, { next: next => {
        if (!current()) return;
        const before = this.state.window!;
        if (next.kind !== before.kind || next.limit !== before.limit || next.search !== before.search || this.retiredEpochs.has(next.epoch)) {
          error(new TypeError('Task stream changed query')); return;
        }
        if (this.firstMessage !== null) this.cancel(this.firstMessage); this.firstMessage = null;
        if (next.revision > before.revision || next.epoch !== before.epoch || next.scope !== before.scope) this.repairBudget = 1;
        this.reconnectAttempt = 0;
        if (next !== before) {
          if (next.epoch !== before.epoch) this.retiredEpochs.add(before.epoch);
          this.update({ window: next, query: Object.freeze({ ...this.state.query, apparatus: next.apparatus_id }), loading: false, error: null });
          this.options.remember?.(next);
        }
      }, error, done: reconnect });
    } catch (reason) { error(reason); }
  }
  /** The owner must call this on any session/scope event; that event source is not implemented here. */
  invalidate() {
    if (this.closed) return;
    this.closed = true; this.generation++; this.pending = null;
    this.stopLive();
    if (this.searchTimer !== null) { this.cancel(this.searchTimer); this.searchTimer = null; }
    this.update({ window: null, loading: false, error: null, active: false });
  }
  dispose() { this.invalidate(); this.listeners.clear(); }
}
