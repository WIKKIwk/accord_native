import type { Apparatus, WorkerQueue } from './workerApi';
import { queueFromSnapshot, workerMachinesFromSnapshot } from './workerApi';
import { sessionReadScope } from './sessionReadScope';
import type { Session } from './auth';
import type { QueueLimit } from './workerQueueLimit';

type Wire = Record<string, unknown>;
export type WorkerQueuePageState = Readonly<{
  queue: WorkerQueue | null; loading: boolean; error: unknown;
  synchronized: boolean; connected: boolean; loadedWindow: string | null;
}>;
export type WorkerQueueClaim = { lease: number; ready: WorkerQueue | null; pending: Promise<WorkerQueue | null> };
export type WorkerQueuePageDependencies = {
  current(): boolean;
  initial(): Promise<WorkerQueue>;
  snapshot(since: Wire | null, fresh: boolean): Promise<Wire>;
  catalog(): Promise<Apparatus[]>;
  live(get: () => Wire | null, callbacks: {
    snapshot(value: Wire): void; invalidate(): void; ready(value: Wire): void;
    error(error: unknown): void; connection(connected: boolean): void;
  }): () => void;
  claim(): WorkerQueueClaim;
  release(lease: number, queue: WorkerQueue | null): void;
  restore(): Promise<WorkerQueue | null>;
  persist(queue: WorkerQueue, flush?: boolean): Promise<void>;
  cancelPersist?(): void;
  forget(): Promise<void>;
  refreshAssignments(): Promise<unknown>;
  retryable(error: unknown): boolean;
};

const cursor = (snapshot: Wire | null) => snapshot && typeof snapshot.epoch === 'string' && snapshot.epoch &&
  typeof snapshot.scope === 'string' && snapshot.scope && Number.isInteger(snapshot.rev) && Number(snapshot.rev) >= 0
  ? { epoch: snapshot.epoch, scope: snapshot.scope, rev: Number(snapshot.rev) } : null;

/** @v2 _AdminProductionMapOrdersLiveState */
export class WorkerQueueController {
  private state: WorkerQueuePageState;
  private listeners = new Set<() => void>();
  private baseline: WorkerQueue | null = null;
  private pendingSnapshot: Wire | null = null;
  private catalogValue: Apparatus[] | null = null;
  private disposed = false;
  private foreground = true;
  private started = false;
  private blocked = false;
  private generation = 0;
  private readGeneration = 0;
  private restoreGeneration = 0;
  private scope: string;
  private lease: number | null = null;
  private reservation: WorkerQueueClaim | null = null;
  private stopLive: (() => void) | null = null;
  private refresh: Promise<void> | null = null;
  private refreshQueued = false;
  private initialRead: Promise<void> | null = null;
  private catalogRead: Promise<void> | null = null;
  private recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private retiredEpochs = new Set<string>();
  private awaitingValidation = false;
  private needsReconcile = false;
  private recoverySupported = false;
  private pendingWrites = 0;
  private assignmentRead = false;

  constructor(private readonly session: Session, readonly search: string, readonly limit: QueueLimit,
    private readonly dependencies: WorkerQueuePageDependencies, initialDisplay: WorkerQueue | null = null) {
    this.scope = sessionReadScope(session);
    this.state = { queue: initialDisplay, loading: true, error: null, synchronized: false,
      connected: false, loadedWindow: null };
  }
  readonly window = (): string => JSON.stringify([this.search, this.limit]);
  readonly getSnapshot = (): WorkerQueuePageState => this.state;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current() { return !this.disposed && this.foreground && this.dependencies.current() && this.scope === sessionReadScope(this.session); }
  private publish(patch: Partial<WorkerQueuePageState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private retire() { this.cancelSave(); this.publish({ synchronized: false }); }
  private cancelSave() { if (this.saveTimer !== undefined) clearTimeout(this.saveTimer); this.saveTimer = undefined; this.dependencies.cancelPersist?.(); }
  private cancelRecovery() { if (this.recoveryTimer !== undefined) clearTimeout(this.recoveryTimer); this.recoveryTimer = undefined; }
  private stop() { this.generation++; this.stopLive?.(); this.stopLive = null; this.publish({ connected: false }); }
  private saveSoon() {
    this.cancelSave();
    if (!this.current() || !this.state.synchronized || this.pendingWrites || !this.baseline || this.search) return;
    // The shared cache owns V2's 400ms debounce and immutable serialization fence.
    void this.dependencies.persist(this.baseline).catch(() => {});
  }
  private accept(queue: WorkerQueue, confirmed: boolean) {
    if (!this.current()) return false;
    const next = cursor(queue.snapshot), old = cursor(this.baseline?.snapshot ?? null);
    if (next && (this.retiredEpochs.has(next.epoch) || old && old.epoch === next.epoch && old.rev > next.rev)) return false;
    if (old && next && old.epoch !== next.epoch) this.retiredEpochs.add(old.epoch);
    this.baseline = queue;
    this.pendingSnapshot = null;
    this.catalogValue = queue.catalog ?? queue.machines;
    this.awaitingValidation = !confirmed;
    this.needsReconcile = !confirmed;
    this.publish({ queue, loading: false, error: null, synchronized: confirmed && !this.pendingWrites, loadedWindow: this.window() });
    if (confirmed) { this.cancelRecovery(); this.saveSoon(); }
    return true;
  }
  private acceptSnapshot(snapshot: Wire) {
    const queue = this.baseline;
    if (!queue) {
      const pending = cursor(this.pendingSnapshot), next = cursor(snapshot);
      if (next && (this.retiredEpochs.has(next.epoch) || pending && pending.epoch === next.epoch && pending.rev > next.rev)) return;
      this.readGeneration++;
      this.pendingSnapshot = snapshot;
      if (this.catalogValue) this.accept(queueFromSnapshot(workerMachinesFromSnapshot(this.catalogValue, snapshot, this.session.assigned_apparatus),
        snapshot, this.session.assigned_apparatus, this.session.assigned_apparatus_labels, this.catalogValue), true);
      else void this.refreshCatalog();
      return;
    }
    const catalog = this.catalogValue ?? queue.catalog ?? queue.machines;
    if (this.accept(queueFromSnapshot(workerMachinesFromSnapshot(catalog, snapshot, this.session.assigned_apparatus), snapshot,
      this.session.assigned_apparatus, this.session.assigned_apparatus_labels, catalog), true)) this.readGeneration++;
  }
  private failure(error: unknown, schedule = true) {
    if (!this.current()) return;
    this.retire();
    this.blocked = !this.dependencies.retryable(error);
    this.publish({ loading: false, error });
    if (this.blocked) {
      this.cancelRecovery(); this.stop();
      void this.dependencies.forget().catch(() => {});
      if (this.awaitingValidation) { this.baseline = null; this.publish({ queue: null, loadedWindow: null }); }
      const failure = error as { statusCode?: number; code?: string } | null;
      if (!this.assignmentRead && (failure?.statusCode === 403 || failure?.code === 'forbidden')) {
        this.assignmentRead = true;
        // A changed assignment publishes a new session scope; the hook then creates its new owner.
        void this.dependencies.refreshAssignments().catch(() => {}).finally(() => { this.assignmentRead = false; });
      }
    } else if (schedule && !this.recoveryTimer && !this.state.connected) {
      // V2 retries the live stream after 2s; it does not poll the HTTP list.
      this.recoveryTimer = setTimeout(() => { this.recoveryTimer = undefined; this.connect(); }, 2000);
    }
  }
  private connect() {
    if (!this.current() || this.blocked) return;
    this.stop();
    const generation = this.generation;
    const current = () => this.current() && generation === this.generation;
    this.stopLive = this.dependencies.live(() => current() ? this.baseline?.snapshot ?? null : null, {
      connection: connected => { if (current()) { this.publish({ connected }); if (!connected) this.retire(); } },
      error: error => { if (current()) this.failure(error, false); },
      invalidate: () => { if (current()) { this.needsReconcile = true; this.retire(); void this.reload(); } },
      snapshot: value => { if (current()) this.acceptSnapshot(value); },
      ready: value => {
        if (!current()) return;
        this.cancelRecovery(); this.publish({ connected: true });
        if (value.recovered === true) this.recoverySupported = true;
        if (this.catalogValue === null) void this.refreshCatalog();
        const before = cursor(this.baseline?.snapshot ?? null);
        if (before && value.resync !== true && before.epoch === value.epoch && before.scope === value.scope && before.rev === value.rev &&
            (!this.needsReconcile || value.recovered === true) && !this.pendingWrites) {
          this.awaitingValidation = false;
          this.needsReconcile = false;
          this.publish({ synchronized: true, error: null, loading: false }); this.saveSoon();
        } else { this.retire(); void this.reload(); }
      },
    });
  }
  /** Reserve ownership before debounce/old-page cleanup, without starting an HTTP read. */
  reserve() {
    if (!this.current() || this.reservation) return;
    this.reservation = this.dependencies.claim();
    this.lease = this.reservation.lease;
  }
  async start() {
    if (this.started || !this.current()) return;
    this.started = true;
    const generation = this.generation;
    this.reserve();
    const claim = this.reservation!;
    let restored = claim.ready;
    if (!restored) {
      const restoreGeneration = ++this.restoreGeneration;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        restored = await Promise.race([this.dependencies.restore().catch(() => null),
          new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 500); })]);
      } finally { if (timer !== undefined) clearTimeout(timer); }
      if (restoreGeneration !== this.restoreGeneration) return;
      // Disk rows must never wait behind an unfinished warm HTTP request.
      if (!restored) restored = await claim.pending.catch(() => null);
    }
    if (!this.current() || generation !== this.generation) return;
    if (restored) this.accept(restored, false);
    else await this.loadInitial();
    if (this.current() && generation === this.generation && !this.blocked) this.connect();
  }
  private loadInitial(): Promise<void> {
    if (this.initialRead) return this.initialRead;
    const read = ++this.readGeneration;
    this.initialRead = (async () => {
      try { const queue = await this.dependencies.initial(); if (this.current() && read === this.readGeneration) this.accept(queue, true); }
      catch (error) { if (this.current() && read === this.readGeneration) this.failure(error); }
    })().finally(() => { this.initialRead = null; });
    return this.initialRead;
  }
  private refreshCatalog(): Promise<void> {
    if (this.catalogRead) return this.catalogRead;
    this.catalogRead = this.dependencies.catalog().then(catalog => {
      if (!this.current()) return;
      this.catalogValue = catalog;
      if (!this.baseline) {
        if (this.pendingSnapshot) this.acceptSnapshot(this.pendingSnapshot);
        return;
      }
      const queue = this.baseline;
      // Catalogue refresh is independent; its failure must not discard valid order state.
      const machines = workerMachinesFromSnapshot(catalog, queue.snapshot, this.session.assigned_apparatus);
      this.accept(queueFromSnapshot(machines, queue.snapshot, this.session.assigned_apparatus,
        this.session.assigned_apparatus_labels, catalog), this.state.synchronized);
    }).catch(() => {}).finally(() => { this.catalogRead = null; });
    return this.catalogRead;
  }
  readonly reload = async (showLoading = false): Promise<void> => {
    if (!this.current()) return;
    if (showLoading) this.publish({ loading: true });
    if (this.blocked) { this.blocked = false; this.connect(); }
    if (this.refresh) { this.refreshQueued = true; return this.refresh; }
    const read = ++this.readGeneration, previous = this.baseline;
    if (!previous && !this.catalogValue) void this.refreshCatalog();
    this.refresh = (async () => {
      try {
        const snapshot = await this.dependencies.snapshot(previous?.snapshot ?? null, this.needsReconcile && !this.awaitingValidation);
        if (!this.current() || read !== this.readGeneration) return;
        if (!previous) this.acceptSnapshot(snapshot);
        else {
          const catalog = this.catalogValue ?? this.baseline?.catalog ?? previous.catalog ?? previous.machines;
          this.accept(queueFromSnapshot(workerMachinesFromSnapshot(catalog, snapshot, this.session.assigned_apparatus), snapshot,
            this.session.assigned_apparatus, this.session.assigned_apparatus_labels, catalog), true);
        }
      } catch (error) { if (this.current() && read === this.readGeneration) this.failure(error); }
      finally {
        this.refresh = null;
        if (this.refreshQueued && this.current()) { this.refreshQueued = false; void this.reload(); }
      }
    })();
    return this.refresh;
  };
  /** @v2 _refreshLive: user refreshes catalog independently from the canonical queue. */
  readonly refreshAll = async (): Promise<void> => {
    if (!this.current()) return;
    await Promise.all([this.reload(), this.refreshCatalog()]);
  };
  /** Retired writes never certify a cache or handoff baseline. */
  setWritePending(pending: boolean) {
    if (!pending && !this.pendingWrites) return;
    this.pendingWrites = Math.max(0, this.pendingWrites + (pending ? 1 : -1));
    if (pending) { this.needsReconcile = true; this.cancelSave(); }
    else if (!this.pendingWrites && this.current()) void this.reload();
  }
  pause() { this.foreground = false; this.readGeneration++; this.restoreGeneration++; this.cancelRecovery(); this.retire(); this.stop(); }
  async resume() {
    if (this.disposed) return;
    this.foreground = true; this.blocked = false;
    if (!this.started) { await this.start(); return; }
    await this.dependencies.refreshAssignments().catch(() => {});
    if (!this.current()) return;
    this.needsReconcile = true;
    this.retire();
    if (!this.recoverySupported || !cursor(this.baseline?.snapshot ?? null)) await this.loadInitial();
    if (this.current()) this.connect();
  }
  dispose() {
    if (this.disposed) return;
    const safe = this.state.synchronized && !this.pendingWrites && !this.search && this.scope === sessionReadScope(this.session) && this.dependencies.current();
    this.cancelRecovery(); this.cancelSave();
    if (this.lease !== null) this.dependencies.release(this.lease, safe ? this.baseline : null);
    if (safe && this.baseline) void this.dependencies.persist(this.baseline, true).catch(() => {});
    this.disposed = true; this.readGeneration++; this.restoreGeneration++; this.stopLive?.(); this.stopLive = null; this.listeners.clear();
  }
}
