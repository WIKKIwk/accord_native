import { InventoryViewQuery, type InventoryAssetsQuery, type InventoryTransfersQuery } from './inventoryViewQuery';

type Row = Record<string, unknown>;
type Message = Record<string, unknown>;
type Unsubscribe = () => void;
export type InventoryLiveHandlers = { message(value: Message): void; error(error: unknown): void; done(): void };
export type InventoryViewDependencies = {
  snapshotLoader(query: InventoryViewQuery): Promise<Row[]>;
  liveLoader(query: InventoryViewQuery, version: string | null, handlers: InventoryLiveHandlers): Unsubscribe;
  scopeReader(): string;
  tokenReader(): string | null;
  liveEnabled(): boolean;
  firstMessageTimeoutMs?: number;
  reconnectDelayMs?: (attempt: number) => number;
  maxIdleViews?: number;
};
const authorizationError = 'Inventar ruxsatlari o‘zgardi. Hisobni yangilang.';
const clearTimer = (timer: ReturnType<typeof setTimeout> | undefined) => { if (timer !== undefined) clearTimeout(timer); };
function keys(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item)) throw new TypeError('Invalid inventory keys');
  return value as string[];
}

/** @v2 InventoryViewStore */
export class InventoryViewStore {
  private readonly entries = new Map<string, InventoryViewEntry>();
  private scope: string | null = null;
  private token: string | null = null;
  private foreground = true;
  private blocked = false;
  private generation = 0;
  private visit = 0;
  constructor(readonly dependencies: InventoryViewDependencies) {}

  locations(): InventoryViewLease { return this.acquire(InventoryViewQuery.locations()); }
  assets(input: InventoryAssetsQuery = {}): InventoryViewLease { return this.acquire(InventoryViewQuery.assets(input)); }
  transfers(input: InventoryTransfersQuery = {}): InventoryViewLease { return this.acquire(InventoryViewQuery.transfers(input)); }

  private acquire(query: InventoryViewQuery): InventoryViewLease {
    this.synchronizeScope();
    let entry = this.entries.get(query.key);
    if (!entry) {
      entry = new InventoryViewEntry(this, query, this.generation);
      if (this.blocked) entry.error = authorizationError;
      this.entries.set(query.key, entry);
    }
    entry.users++; entry.visit = ++this.visit;
    const lease = new InventoryViewLease(entry);
    this.trim();
    return lease;
  }

  configure(foreground: boolean): void {
    this.foreground = foreground;
    this.synchronizeScope();
    for (const entry of [...this.entries.values()]) {
      if (foreground && !this.blocked) void entry.ensure().catch(() => {});
      else entry.stop();
    }
  }

  private synchronizeScope(): void {
    const scope = this.dependencies.scopeReader(), token = this.dependencies.tokenReader();
    if (scope !== this.scope) {
      this.reset(); this.scope = scope; this.token = token; return;
    }
    if (this.token === token) return;
    this.token = token;
    const entries = [...this.entries.values()];
    for (const entry of entries) entry.stop();
    if (this.foreground && !this.blocked) for (const entry of entries) void entry.ensure().catch(() => {});
  }

  reset(): void {
    this.generation++;
    const previous = [...this.entries.values()];
    this.entries.clear(); this.scope = null; this.token = null; this.blocked = false;
    for (const entry of previous) entry.clear();
  }

  async reconcileAfterWrite(): Promise<void> {
    await Promise.all([...this.entries.values()].filter(entry => !entry.trusted && this.current(entry)).map(entry => entry.refresh()));
  }

  resetAuthorization(): void {
    this.blocked = true; this.generation++;
    for (const entry of this.entries.values()) entry.clear(authorizationError);
    this.entries.clear();
  }

  current(entry: InventoryViewEntry): boolean {
    return entry.generation === this.generation && this.scope === this.dependencies.scopeReader() &&
      this.token === this.dependencies.tokenReader() && this.entries.get(entry.query.key) === entry && !this.blocked;
  }
  canConnect(entry: InventoryViewEntry): boolean { return this.current(entry) && this.foreground; }
  release(entry: InventoryViewEntry): void { entry.users--; this.trim(); }

  private trim(): void {
    const all = [...this.entries.values()];
    const idle = all.filter(entry => entry.users === 0).sort((a, b) => b.visit - a.visit);
    const buckets = new Set(all.filter(entry => entry.users > 0).map(entry => entry.query.liveBucket));
    let retained = 0;
    for (const entry of idle) {
      if (retained >= (this.dependencies.maxIdleViews ?? 6) || buckets.has(entry.query.liveBucket)) {
        this.entries.delete(entry.query.key); entry.stop();
      } else { retained++; buckets.add(entry.query.liveBucket); }
    }
  }
}

/** @v2 InventoryViewLease */
export class InventoryViewLease {
  readonly ready: Promise<void>;
  private readonly listeners = new Map<() => void, () => void>();
  private disposed = false;
  constructor(private readonly entry: InventoryViewEntry) {
    this.ready = entry.ensure();
    void this.ready.catch(() => {});
  }
  get rows(): readonly Row[] | null { return this.entry.rows; }
  get loading(): boolean { return this.entry.loading; }
  get error(): string | null { return this.entry.error; }
  get trusted(): boolean { return this.entry.trusted; }
  refresh(): Promise<void> { return this.entry.refresh(); }
  addListener(listener: () => void): void {
    if (this.disposed || this.listeners.has(listener)) return;
    const relay = () => listener();
    this.listeners.set(listener, relay); this.entry.listeners.add(relay);
  }
  removeListener(listener: () => void): void {
    const relay = this.listeners.get(listener);
    if (relay) { this.listeners.delete(listener); this.entry.listeners.delete(relay); }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const relay of this.listeners.values()) this.entry.listeners.delete(relay);
    this.listeners.clear(); this.entry.store.release(this.entry);
  }
}

class InventoryViewEntry {
  users = 0;
  visit = 0;
  rows: readonly Row[] | null = null;
  loading = false;
  trusted = false;
  error: string | null = null;
  readonly listeners = new Set<() => void>();
  private version: string | null = null;
  private epoch: string | null = null;
  private revision: number | null = null;
  private connection = 0;
  private attempt = 0;
  private fallbackRead = false;
  private unsubscribe: Unsubscribe | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setTimeout> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private preparing: { promise: Promise<void>; resolve(): void; reject(error: unknown): void } | null = null;
  constructor(readonly store: InventoryViewStore, readonly query: InventoryViewQuery, readonly generation: number) {}

  private notify(): void { for (const listener of this.listeners) listener(); }
  ensure(): Promise<void> {
    if (!this.store.current(this)) return Promise.resolve();
    if (this.trusted && this.unsubscribe) return Promise.resolve();
    if (this.preparing) return this.preparing.promise;
    if (!this.store.canConnect(this)) return Promise.resolve();
    this.stopSocket(); this.fallbackRead = false;
    let resolve!: () => void, reject!: (error: unknown) => void;
    const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
    this.preparing = { promise, resolve, reject };
    this.loading = this.rows == null; this.error = null; this.notify();
    if (this.store.dependencies.liveEnabled()) this.connect(); else void this.fallback();
    return promise;
  }
  refresh(): Promise<void> {
    if (!this.store.current(this)) return Promise.resolve();
    this.stop(); this.fallbackRead = false; return this.ensure();
  }
  private connect(): void {
    if (!this.store.canConnect(this)) return;
    clearTimer(this.retry); this.retry = undefined;
    const connection = ++this.connection;
    this.timeout = setTimeout(() => { if (connection === this.connection) this.lost(); },
      this.store.dependencies.firstMessageTimeoutMs ?? 10_000);
    try {
      const unsubscribe = this.store.dependencies.liveLoader(this.query, this.version, {
        message: message => {
          if (connection !== this.connection || !this.store.current(this)) return;
          try { this.receive(message); } catch { this.lost(); }
        },
        error: () => { if (connection === this.connection) this.lost(); },
        done: () => { if (connection === this.connection) this.lost(); },
      });
      if (connection === this.connection) this.unsubscribe = unsubscribe; else unsubscribe();
    } catch { this.lost(); }
  }
  private receive(message: Message): void {
    const event = message.event;
    if (event === 'inventory.reset') { this.store.resetAuthorization(); return; }
    if (event === 'inventory.error') throw new TypeError('Inventory live rejected');
    if (event === 'inventory.heartbeat') { if (message.epoch === this.epoch && this.trusted) this.armHeartbeat(); return; }
    if (message.id !== 'window') return;
    const epoch = message.epoch, revision = message.revision, version = message.version;
    if (typeof epoch !== 'string' || !epoch || !Number.isInteger(revision) || (revision as number) < 0 ||
        typeof version !== 'string' || !version) throw new TypeError('Invalid inventory revision');
    if (event === 'inventory.snapshot') {
      const rows = this.decodeRows(message.rows); this.validateUnique(rows); this.rows = Object.freeze(rows);
    } else if (event === 'inventory.ready') {
      if (!this.rows || version !== this.version) throw new TypeError('Unknown inventory baseline');
    } else if (event === 'inventory.delta') {
      if (this.trusted && epoch === this.epoch && (revision as number) <= this.revision!) return;
      if (!this.rows || !this.trusted || epoch !== this.epoch || message.base_revision !== this.revision ||
          revision !== this.revision! + 1) throw new TypeError('Inventory delta revision gap');
      const next = new Map(this.rows.map(row => [this.query.rowKey(row), row]));
      for (const key of keys(message.removed)) {
        if (!next.has(key)) throw new TypeError('Unknown removed inventory row');
        next.delete(key);
      }
      const upserts = this.decodeRows(message.upserts); this.validateUnique(upserts);
      for (const row of upserts) next.set(this.query.rowKey(row), row);
      const order = keys(message.order);
      if (order.length !== next.size || new Set(order).size !== order.length || order.some(key => !next.has(key))) {
        throw new TypeError('Invalid inventory window order');
      }
      this.rows = Object.freeze(order.map(key => next.get(key)!));
    } else return;
    this.epoch = epoch; this.revision = revision as number; this.version = version;
    this.trusted = true; this.loading = false; this.error = null; this.attempt = 0; this.fallbackRead = false;
    clearTimer(this.timeout); this.timeout = undefined; this.armHeartbeat(); this.complete(); this.notify();
  }
  private armHeartbeat(): void { clearTimer(this.heartbeat); this.heartbeat = setTimeout(() => this.lost(), 55_000); }
  private decodeRows(value: unknown): Row[] {
    if (!Array.isArray(value)) throw new TypeError('Expected inventory rows');
    return value.map(row => this.query.decode(row));
  }
  private validateUnique(rows: readonly Row[]): void {
    const values = rows.map(row => this.query.rowKey(row));
    if (new Set(values).size !== values.length || values.some(key => !key)) throw new TypeError('Duplicate inventory rows');
  }
  private lost(): void {
    this.stopSocket();
    if (!this.store.current(this)) return;
    this.trusted = false; this.loading = this.rows == null; this.notify();
    if (!this.fallbackRead) void this.fallback(); else this.scheduleReconnect();
  }
  private async fallback(): Promise<void> {
    if (!this.store.current(this) || this.fallbackRead) return;
    this.fallbackRead = true;
    const connection = this.connection;
    try {
      const rows = await this.store.dependencies.snapshotLoader(this.query);
      if (!this.store.current(this) || connection !== this.connection) return;
      this.validateUnique(rows); this.rows = Object.freeze([...rows]); this.version = null;
      this.error = null; this.loading = false; this.complete();
    } catch (error) {
      if (!this.store.current(this) || connection !== this.connection) return;
      const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
      if (status === 401 || status === 403) { this.store.resetAuthorization(); return; }
      this.error = error instanceof Error && error.name === 'MobileApiException' ? error.message : String(error);
      this.loading = false; this.complete(this.rows == null ? error : undefined);
    }
    if (!this.store.current(this)) return;
    this.notify();
    if (this.store.dependencies.liveEnabled()) this.scheduleReconnect();
  }
  private scheduleReconnect(): void {
    if (!this.store.canConnect(this) || this.retry !== undefined) return;
    const attempt = this.attempt++;
    const delay = this.store.dependencies.reconnectDelayMs?.(attempt) ?? Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    this.retry = setTimeout(() => { this.retry = undefined; if (this.store.canConnect(this)) this.connect(); }, delay);
  }
  private complete(error?: unknown): void {
    const preparing = this.preparing; this.preparing = null;
    if (!preparing) return;
    if (error !== undefined) preparing.reject(error); else preparing.resolve();
  }
  private stopSocket(): void {
    this.connection++;
    clearTimer(this.timeout); this.timeout = undefined; clearTimer(this.heartbeat); this.heartbeat = undefined;
    const unsubscribe = this.unsubscribe; this.unsubscribe = null; unsubscribe?.();
  }
  stop(): void {
    clearTimer(this.retry); this.retry = undefined; this.stopSocket(); this.trusted = false; this.complete(); this.loading = false;
  }
  clear(error: string | null = null): void {
    this.stop(); this.rows = null; this.version = null; this.epoch = null; this.revision = null; this.error = error; this.notify();
  }
}
