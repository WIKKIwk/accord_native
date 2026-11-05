import type { Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import type { ProductionSnapshotStore } from '../shared/productionSnapshotStore';
import { WorkerControlException } from '../workerControlsApi';
import { preparationOrderListWindowFromJson, type PreparationOrderListWindow } from './preparationOrdersApi';

type LoadOptions = { apparatus: string; search: string; cursor: string | null; baseline: PreparationOrderListWindow | null; refresh: boolean };
type Options = { session: () => Session | null; enabled: () => boolean; snapshots: ProductionSnapshotStore;
  loader: (options: LoadOptions) => Promise<PreparationOrderListWindow>; selectionLoader: () => Promise<string | null> };
const normalize = (value: string) => value.trim().toLowerCase();
const keyFor = (apparatus: string, search: string) => JSON.stringify(['preparation-orders-v1', apparatus, normalize(search)]);
const asWire = (window: PreparationOrderListWindow) => ({ ...window, ok: true, projection: 'preparation_order_list_v1' });

/** @v2 PreparationOrdersWarmStore */
export class PreparationOrdersWarmStore {
  private readonly windows = new Map<string, PreparationOrderListWindow>();
  private readonly pending = new Map<string, Promise<PreparationOrderListWindow>>();
  private readonly forcedReads = new Set<string>();
  private readonly restores = new Map<string, Promise<PreparationOrderListWindow | null>>();
  private readonly readSerials = new Map<string, number>();
  private owner: string | null = null;
  private generation = 0;
  private serverSerial = 0;
  private nextReadSerial = 0;
  private prepared = false;
  private denied = false;
  constructor(private readonly options: Options) {}
  private get currentOwner(): string {
    const session = this.options.session();
    return JSON.stringify([session ? sessionReadScope(session) : '', this.options.snapshots.generation]);
  }
  private synchronize() { const owner = this.currentOwner; if (owner !== this.owner) { this.reset(); this.owner = owner; } }
  private current(owner: string, generation: number) {
    return this.options.enabled() && owner === this.owner && owner === this.currentOwner && generation === this.generation;
  }
  async prepare() {
    this.synchronize();
    if (!this.options.enabled() || this.prepared || this.denied) return;
    this.prepared = true;
    const owner = this.owner!, generation = this.generation;
    try {
      const apparatus = await this.options.selectionLoader() ?? '';
      if (!this.current(owner, generation)) return;
      void this.restore({ apparatus }); await this.read({ apparatus, fresh: true });
    } catch { /* The foreground screen retries. */ }
  }
  peek(options: { apparatus?: string; search?: string } = {}) {
    this.synchronize();
    return this.options.enabled() && !this.denied ? this.windows.get(keyFor(options.apparatus ?? '', options.search ?? '')) ?? null : null;
  }
  restore(options: { apparatus?: string; search?: string } = {}): Promise<PreparationOrderListWindow | null> {
    this.synchronize();
    if (!this.options.enabled() || this.denied) return Promise.resolve(null);
    const apparatus = options.apparatus ?? '', search = normalize(options.search ?? ''), ready = this.peek({ apparatus, search });
    if (ready) return Promise.resolve(ready);
    const key = keyFor(apparatus, search), pending = this.restores.get(key);
    if (pending) return pending;
    const owner = this.owner!, generation = this.generation, serverSerial = this.serverSerial, session = this.options.session();
    if (!session) return Promise.resolve(null);
    const scope = sessionReadScope(session);
    let future: Promise<PreparationOrderListWindow | null>;
    future = (async () => {
      const saved = await this.options.snapshots.read(scope, key);
      if (!this.current(owner, generation) || this.denied) return null;
      if (this.serverSerial !== serverSerial) return this.peek({ apparatus, search });
      if (!saved) return null;
      try {
        if (saved.schema !== 1 || saved.search !== search) throw new Error('Invalid cache');
        const window = preparationOrderListWindowFromJson(saved.window);
        if (window.search !== search || (apparatus && window.apparatus_id !== apparatus)) throw new Error('Invalid scope');
        this.rememberInternal(window, search, false); return window;
      } catch { void this.options.snapshots.remove(scope, key); return null; }
    })().finally(() => { if (this.restores.get(key) === future) this.restores.delete(key); });
    this.restores.set(key, future); return future;
  }
  read(options: { apparatus?: string; search?: string; cursor?: string | null; baseline?: PreparationOrderListWindow | null;
    fresh?: boolean; force?: boolean } = {}): Promise<PreparationOrderListWindow> {
    this.synchronize();
    const apparatus = options.apparatus ?? '', search = normalize(options.search ?? ''), cursor = options.cursor ?? null;
    const key = keyFor(apparatus, search), ready = this.peek({ apparatus, search });
    if (!options.fresh && !options.force && cursor === null && ready) return Promise.resolve(ready);
    const pendingKey = JSON.stringify([key, cursor]), pending = this.pending.get(pendingKey);
    if (pending) {
      if (options.force && !this.forcedReads.has(pendingKey)) return pending.then(() => this.read({ ...options, fresh: true, force: true }));
      return pending;
    }
    const owner = this.owner!, generation = this.generation, serial = ++this.nextReadSerial;
    this.readSerials.set(key, serial);
    const requireCurrent = () => { if (!this.current(owner, generation)) throw new WorkerControlException('session_changed', 'Buyurtmalar hisob doirasi o‘zgardi.'); };
    let future: Promise<PreparationOrderListWindow>;
    future = (async () => {
      requireCurrent();
      try {
        const window = await this.options.loader({ apparatus, search, cursor,
          baseline: this.denied || cursor !== null ? null : options.baseline ?? ready, refresh: options.force ?? false });
        requireCurrent();
        if (this.readSerials.get(key) !== serial) {
          const latest = this.peek({ apparatus, search });
          if (cursor === null && latest) return latest;
          throw new WorkerControlException('preparation_orders_resync', 'Buyurtmalar o‘zgardi. Qayta yuklang.', 409);
        }
        if (window.search !== search) throw new WorkerControlException('preparation_orders_invalid', 'Buyurtmalar so‘rovi mos kelmadi.');
        this.denied = false;
        if (cursor === null) { this.serverSerial++; this.rememberInternal(window, search); }
        return window;
      } catch (error) {
        if (this.current(owner, generation) && error instanceof WorkerControlException &&
          (error.statusCode === 401 || error.statusCode === 403 || ['unauthorized', 'forbidden'].includes(error.code))) void this.forget({ apparatus, search });
        throw error;
      }
    })().finally(() => {
      if (this.pending.get(pendingKey) === future) { this.pending.delete(pendingKey); this.forcedReads.delete(pendingKey); }
      if (this.readSerials.get(key) === serial) this.readSerials.delete(key);
    });
    this.pending.set(pendingKey, future); if (options.force) this.forcedReads.add(pendingKey); return future;
  }
  remember(window: PreparationOrderListWindow, search = '') {
    this.synchronize(); if (!this.options.enabled()) return;
    search = normalize(search);
    const previous = this.windows.get(keyFor(window.apparatus_id, search));
    if (previous && previous.scope === window.scope && previous.epoch === window.epoch && previous.rev > window.rev) return;
    for (const key of new Set([keyFor('', search), keyFor(window.apparatus_id, search)])) this.readSerials.set(key, ++this.nextReadSerial);
    this.serverSerial++; this.denied = false; this.rememberInternal({ ...window, search }, search);
  }
  private rememberInternal(window: PreparationOrderListWindow, search: string, persist = true) {
    const session = this.options.session(); if (!session) return;
    const scope = sessionReadScope(session);
    for (const key of new Set([keyFor('', search), keyFor(window.apparatus_id, search)])) {
      const previous = this.windows.get(key); this.windows.delete(key); this.windows.set(key, window);
      if (persist && (previous?.version !== window.version || previous?.epoch !== window.epoch || previous?.scope !== window.scope || previous?.rows.length !== window.rows.length)) {
        void this.options.snapshots.write(scope, key, { schema: 1, search, window: asWire(window) });
      }
    }
    while (this.windows.size > 8) { const oldest = this.windows.keys().next().value!; this.windows.delete(oldest); this.readSerials.delete(oldest); }
  }
  async forget(options: { apparatus?: string; search?: string } = {}) {
    this.synchronize();
    const session = this.options.session(), scope = session ? sessionReadScope(session) : '';
    const keys = new Set([...this.windows.keys(), keyFor('', options.search ?? ''), keyFor(options.apparatus ?? '', options.search ?? '')]);
    this.generation++; this.serverSerial++; this.windows.clear(); this.pending.clear(); this.forcedReads.clear();
    this.readSerials.clear(); this.restores.clear(); this.denied = true;
    await Promise.all([...keys].map(key => this.options.snapshots.remove(scope, key)));
  }
  reset() {
    this.generation++; this.serverSerial++; this.owner = null; this.windows.clear(); this.pending.clear(); this.forcedReads.clear();
    this.restores.clear(); this.readSerials.clear(); this.prepared = false; this.denied = false;
  }
}
