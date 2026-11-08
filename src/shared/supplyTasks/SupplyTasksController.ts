import { activeSessionToken, type Session } from '../../auth';
import { sessionReadScope } from '../../sessionReadScope';
import { appRoutes, canOpenRoute } from '../appRoutes';
import { isSynchronouslyTrue } from '../camera/synchronousGuard';
import { dartTrim, isAscii } from '../dartApparatus';
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
  loadWindow: (query: SupplyTasksQuery, isCurrent: () => boolean) => Promise<SupplyTaskWindow>;
  schedule?: (callback: () => void, milliseconds: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};
const empty = (kind: SupplyTaskKind, apparatus = ''): SupplyTasksState => Object.freeze({
  query: Object.freeze({ kind, apparatus, limit: 10, search: '' }), searchInput: '', window: null, loading: true, error: null, active: false,
});

/** Unconnected f119 compact task-window state; no WebSocket, persistence, route or production reader is installed. */
export class SupplyTasksController {
  private readonly session: Session;
  private readonly scope: string;
  private readonly token: string | null;
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

  constructor(options: Dependencies) {
    if (options.kind !== 'material' && options.kind !== 'qolip') throw new TypeError('Invalid supply task kind');
    this.session = options.session; this.scope = sessionReadScope(options.session); this.token = activeSessionToken(options.session);
    this.isCurrent = options.isCurrent; this.loadWindow = options.loadWindow;
    this.schedule = options.schedule ?? setTimeout; this.cancel = options.cancel ?? clearTimeout;
    this.route = options.kind === 'material' ? appRoutes.materialTasks : appRoutes.qolipTasks;
    this.state = empty(options.kind, options.initialApparatus ?? '');
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<SupplyTasksState>) {
    this.state = Object.freeze({ ...this.state, ...patch });
    this.listeners.forEach(listener => listener());
  }
  private current(generation = this.generation): boolean {
    try {
      const allowed = () => sessionReadScope(this.session) === this.scope && canOpenRoute(this.session, this.route);
      return !this.closed && this.state.active && generation === this.generation && !!this.token &&
        activeSessionToken(this.session) === this.token && allowed() && isSynchronouslyTrue(this.isCurrent) &&
        activeSessionToken(this.session) === this.token && allowed() && !this.closed && generation === this.generation;
    } catch { return false; }
  }
  activate(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.update({ active: true });
    if (!this.current()) { this.invalidate(); return Promise.resolve(); }
    return this.refresh();
  }
  refresh(): Promise<void> {
    if (!this.current()) return Promise.resolve();
    if (this.pending) return this.pending;
    const generation = this.generation, query = this.state.query;
    const request = Promise.resolve().then(() => this.load(generation, query)).finally(() => {
      if (this.pending === request) this.pending = null;
    });
    this.pending = request;
    this.update({ error: null });
    return request;
  }
  private async load(generation: number, query: SupplyTasksQuery): Promise<void> {
    if (!this.current(generation)) return;
    try {
      const next = await this.loadWindow(query, () => this.current(generation));
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
    } catch (error) {
      if (!this.current(generation)) return;
      const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
      this.update({ loading: false, error, ...((status === 401 || status === 403) ? { window: null } : {}) });
    }
  }
  private changeQuery(patch: Partial<Pick<SupplyTasksQuery, 'apparatus' | 'limit' | 'search'>>): Promise<void> {
    if (!this.current()) return Promise.resolve();
    this.generation++; this.pending = null;
    this.update({ query: Object.freeze({ ...this.state.query, ...patch }), loading: true });
    return this.refresh();
  }
  selectApparatus(id: string): Promise<void> {
    if (!this.current() || !this.state.window?.apparatus.some(item => item.id === id)) return Promise.resolve();
    return this.changeQuery({ apparatus: id });
  }
  selectLimit(limit: number): Promise<void> {
    if (![5, 10, 20, 50].includes(limit)) return Promise.resolve();
    return this.changeQuery({ limit });
  }
  /** Returns false when Unicode search is withheld pending Dart/Hermes case-mapping parity. */
  setSearchInput(value: string): boolean {
    if (!this.current() || typeof value !== 'string') return false;
    if (this.searchTimer !== null) { this.cancel(this.searchTimer); this.searchTimer = null; }
    if (!isAscii(dartTrim(value))) return false;
    this.update({ searchInput: value });
    this.searchTimer = this.schedule(() => {
      this.searchTimer = null;
      if (this.current()) void this.changeQuery({ search: dartTrim(value).toLowerCase() });
    }, 250);
    return true;
  }
  /** The owner must call this on any session/scope event; that event source is not implemented here. */
  invalidate() {
    if (this.closed) return;
    this.closed = true; this.generation++; this.pending = null;
    if (this.searchTimer !== null) { this.cancel(this.searchTimer); this.searchTimer = null; }
    this.update({ window: null, loading: false, error: null, active: false });
  }
  dispose() { this.invalidate(); this.listeners.clear(); }
}
