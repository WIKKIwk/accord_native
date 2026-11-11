import { activeSessionToken, type Session } from './auth';
import { loadWorkerQueueBaseline, queueFromSnapshot, type WorkerQueue } from './workerApi';
import { sessionReadScope } from './sessionReadScope';
import { subscribeWorkerLive } from './workerLive';
import { DEFAULT_QUEUE_LIMIT, loadQueueLimit, type QueueLimit } from './workerQueueLimit';
import { workerQueueSearch } from './workerQueueWindow';
import { workerSnapshotCursor } from './workerDelta';
import { saveWorkerQueue, forgetWorkerQueue, cancelPendingWorkerQueueSave, decodeWorkerQueueSnapshot } from './workerQueueCache';

type Options = {
  current?: (session: Session) => boolean;
  loader?: (session: Session, search: string, limit: QueueLimit) => Promise<WorkerQueue>;
  limitLoader?: (session: Session) => Promise<QueueLimit>;
  live?: typeof subscribeWorkerLive;
  save?: typeof saveWorkerQueue;
  forget?: typeof forgetWorkerQueue;
  cancelSave?: typeof cancelPendingWorkerQueueSave;
  loadTimeoutMs?: number;
  reconnectDelay?: (attempt: number) => number;
};
export type WorkerQueueClaim = { lease: number; ready: WorkerQueue | null; pending: Promise<WorkerQueue | null> };
const denied = (error: unknown): boolean => {
  const value = error as { statusCode?: number; code?: string } | null;
  return !!value && (value.statusCode === 401 || value.statusCode === 403 ||
    ['unauthorized', 'forbidden', 'permission_denied'].includes(value.code ?? ''));
};

/** @v2 WorkerQueueWarmStore */
export class WorkerQueueWarmStore {
  private session: Session | null = null;
  private scope: string | null = null;
  private limit: QueueLimit = DEFAULT_QUEUE_LIMIT;
  private search = '';
  private value: WorkerQueue | null = null;
  private starting: Promise<void> | null = null;
  private preparing: Promise<WorkerQueue | null> | null = null;
  private foreground = true;
  private lease: number | null = null;
  private claimWindow: { limit: QueueLimit; search: string } | null = null;
  private nextLease = 0;
  private blocked = false;
  private generation = 0;
  private socketGeneration = 0;
  private stop: (() => void) | null = null;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;
  private repairBudget = 1;
  constructor(private readonly options: Options = {}) {}
  private current(session = this.session): session is Session {
    return !!session && this.session === session && this.scope === sessionReadScope(session) &&
      (this.options.current?.(session) ?? !!activeSessionToken(session));
  }
  private matches(session: Session, limit: QueueLimit, search: string): boolean {
    return this.current(session) && this.limit === limit && this.search === workerQueueSearch(search);
  }
  private configure(session: Session, limit: QueueLimit, search: string): void {
    if (this.current(session)) return;
    this.reset(); this.session = session; this.scope = sessionReadScope(session); this.limit = limit; this.search = workerQueueSearch(search);
  }
  private get canStream(): boolean { return this.current() && this.foreground && this.lease === null && !this.blocked; }
  get pageLease(): number | null { return this.lease; }
  get preparedLimit(): QueueLimit | null { return this.current() && this.value && !this.search ? this.limit : null; }
  peek(session: Session, limit: QueueLimit, search = ''): WorkerQueue | null {
    return !this.blocked && this.matches(session, limit, search) ? this.value : null;
  }

  /** Runtime preparation joins the same initial read as an immediately opened page. */
  start(session: Session): Promise<void> {
    if (this.current(session)) { this.resume(); return this.starting ?? Promise.resolve(); }
    this.configure(session, DEFAULT_QUEUE_LIMIT, ''); this.foreground = true;
    const generation = this.generation;
    const starting = (async () => {
      let limit = DEFAULT_QUEUE_LIMIT;
      try { limit = await (this.options.limitLoader ?? loadQueueLimit)(session); } catch { /* Optional preferences never block warming. */ }
      if (!this.current(session) || generation !== this.generation) return;
      this.limit = limit;
      await this.read(generation);
    })().finally(() => { if (this.starting === starting) this.starting = null; });
    this.starting = starting; return starting;
  }

  prepare(session: Session, limit: QueueLimit, search = ''): Promise<WorkerQueue | null> {
    this.configure(session, limit, search);
    if (!this.matches(session, limit, search) || this.blocked) return Promise.resolve(null);
    return this.read(this.generation);
  }

  /** Stop background ownership before the first await, then join pending preparation. */
  claim(session: Session, limit: QueueLimit, search = ''): WorkerQueueClaim {
    this.configure(session, limit, search);
    (this.options.cancelSave ?? cancelPendingWorkerQueueSave)(session, this.limit, this.search);
    const lease = this.lease = ++this.nextLease;
    this.claimWindow = { limit, search: workerQueueSearch(search) };
    this.stopSocket();
    const generation = this.generation, ready = this.peek(session, limit, search);
    const current = () => this.current(session) && generation === this.generation && lease === this.lease && this.matches(session, limit, search);
    const pending = (async () => {
      await this.starting;
      if (!current()) return null;
      const value = this.preparing ? await this.preparing : this.value;
      return current() ? value : null;
    })();
    return { lease, ready, pending };
  }

  /** A null latest discards the pre-navigation baseline after unconfirmed page writes. */
  release(lease: number, latest: WorkerQueue | null): void {
    if (!this.current() || lease !== this.lease || !this.claimWindow) return;
    this.stopSocket(); this.generation++; this.preparing = null; this.starting = null;
    const searched = !!this.claimWindow.search;
    this.limit = this.claimWindow.limit; this.search = '';
    this.lease = null; this.claimWindow = null; this.repairBudget = 1;
    try {
      if (latest && !searched) decodeWorkerQueueSnapshot(latest.snapshot, this.session!);
      this.value = latest && !searched && workerSnapshotCursor(latest.snapshot) ? latest : null;
    } catch { this.value = null; }
    if (!this.canStream) return;
    if (this.value) { this.persist(); this.connect(); }
    else void this.read(this.generation);
  }
  pause(): void { this.foreground = false; this.stopSocket(); }
  resume(): void {
    if (!this.foreground) this.repairBudget = 1;
    this.foreground = true;
    if (!this.canStream || this.starting || this.preparing) return;
    if (this.value) { if (!this.stop && this.retry === undefined) this.connect(); }
    else void this.read(this.generation);
  }
  reset(): void {
    this.generation++; this.stopSocket(); this.session = null; this.scope = null; this.value = null;
    this.starting = null; this.preparing = null; this.lease = null; this.claimWindow = null;
    this.foreground = false; this.blocked = false; this.attempt = 0; this.repairBudget = 1;
    this.limit = DEFAULT_QUEUE_LIMIT; this.search = '';
  }

  private read(generation: number): Promise<WorkerQueue | null> {
    if (!this.current() || generation !== this.generation || this.blocked) return Promise.resolve(null);
    if (this.preparing) return this.preparing;
    const session = this.session!, limit = this.limit, search = this.search;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = (async () => {
      try {
        const queue = await Promise.race([
          (this.options.loader ?? loadWorkerQueueBaseline)(session, search, limit),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Worker queue preparation timed out')), this.options.loadTimeoutMs ?? 10_000); }),
        ]);
        if (!this.current(session) || generation !== this.generation || limit !== this.limit || search !== this.search) return null;
        decodeWorkerQueueSnapshot(queue.snapshot, session);
        if (!workerSnapshotCursor(queue.snapshot)) return null;
        this.value = queue;
        if (this.canStream) this.connect();
        return queue;
      } catch (error) {
        if (generation === this.generation && this.current(session) && denied(error)) this.withdraw();
        return null;
      } finally { if (timer !== undefined) clearTimeout(timer); }
    })().finally(() => { if (this.preparing === pending) this.preparing = null; });
    this.preparing = pending; return pending;
  }
  private persist(): void {
    if (this.current() && this.value) void (this.options.save ?? saveWorkerQueue)(this.session!, this.limit, this.search, this.value).catch(() => {});
  }
  private healthy(): void { this.attempt = 0; this.repairBudget = 1; this.persist(); }
  private withdraw(): void {
    this.value = null; this.blocked = true; this.stopSocket();
    if (this.session) void (this.options.forget ?? forgetWorkerQueue)(this.session, this.limit, this.search);
  }
  private reconcile(): void {
    if (!this.canStream) return;
    (this.options.cancelSave ?? cancelPendingWorkerQueueSave)(this.session!, this.limit, this.search);
    this.stopSocket();
    if (this.repairBudget > 0) { this.repairBudget--; void this.read(this.generation); return; }
    const attempt = this.attempt++;
    const delay = this.options.reconnectDelay?.(attempt) ?? Math.round(Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)) * (0.5 + Math.random() / 2));
    this.retry = setTimeout(() => { this.retry = undefined; this.connect(); }, delay);
  }
  private connect(): void {
    if (!this.canStream || !this.value) return;
    this.stopSocket();
    const generation = this.socketGeneration, session = this.session!;
    const current = () => this.canStream && generation === this.socketGeneration;
    const stop = (this.options.live ?? subscribeWorkerLive)(session, this.search, () => { if (current()) this.reconcile(); }, undefined,
      () => current() ? this.value?.snapshot ?? null : null,
      snapshot => {
        if (!current() || !this.value) return;
        this.value = queueFromSnapshot(this.value.machines, snapshot, session.assigned_apparatus, session.assigned_apparatus_labels, this.value.catalog);
        this.healthy();
      }, this.limit, {
        isCurrent: current, manageAppState: false,
        onReady: message => {
          if (!current()) return;
          const cursor = workerSnapshotCursor(this.value?.snapshot);
          if (cursor && message.resync !== true && cursor.epoch === message.epoch && cursor.scope === message.scope && cursor.rev === message.rev) this.healthy();
        },
        onError: error => { if (current() && denied(error)) this.withdraw(); },
      });
    if (current()) this.stop = stop; else stop();
  }
  private stopSocket(): void {
    this.socketGeneration++;
    if (this.retry !== undefined) clearTimeout(this.retry);
    this.retry = undefined;
    const stop = this.stop; this.stop = null; stop?.();
  }
}

export const workerQueueWarmStore = new WorkerQueueWarmStore();
