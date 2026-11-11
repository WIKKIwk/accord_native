import { activeSessionToken, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { queueFromSnapshot, workerMachinesFromSnapshot, type Apparatus, type WorkerQueue } from './workerApi';
import { decodeWorkerListSnapshot } from './workerSnapshot';
import { decodeWorkerLegacySnapshot } from './workerLegacyState';
import { isCanonicalApparatusId } from './workerControlsApi';
import { workerQueueSearch } from './workerQueueWindow';
import type { QueueLimit } from './workerQueueLimit';
import type { ProductionSnapshotStore } from './shared/productionSnapshotStore';
import { productionSnapshotStore } from './shared/productionSnapshotRuntime';

type Snapshots = Pick<ProductionSnapshotStore, 'read' | 'writeEncoded' | 'remove' | 'generation'>;
type Options = { snapshots: Snapshots; current?: (session: Session) => boolean; restoreTimeoutMs?: number; saveDelayMs?: number };
type Save = { timer: ReturnType<typeof setTimeout>; finish: () => void; flush: () => Promise<void> };

/** @v2 _canonicalCacheKey */
export const workerQueueCacheKey = (limit: QueueLimit, search: string): string =>
  JSON.stringify(['canonical-worker-queue-v1', limit, workerQueueSearch(search)]);

export function decodeWorkerQueueSnapshot(value: unknown, session: Session): Record<string, unknown> {
  const snapshot = value && typeof value === 'object' && (value as Record<string, unknown>).projection === 'worker_list_v1'
    ? decodeWorkerListSnapshot(value) : decodeWorkerLegacySnapshot(value, session);
  if (typeof snapshot.scope !== 'string' || !snapshot.scope) throw new TypeError('Worker cache requires a scoped cursor');
  return snapshot;
}

function catalogFromCache(value: unknown): Apparatus[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new TypeError('Invalid worker apparatus cache');
  const ids = new Set<string>();
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid cached apparatus');
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !isCanonicalApparatusId(item.id) || ids.has(item.id) ||
        typeof item.name !== 'string' || !item.name.trim() || typeof item.operation !== 'string' || !item.operation.trim() ||
        (item.worker_material_assignment_allowed !== undefined && typeof item.worker_material_assignment_allowed !== 'boolean')) {
      throw new TypeError('Invalid cached apparatus');
    }
    ids.add(item.id);
    return { id: item.id, name: item.name, operation: item.operation,
      ...(item.worker_material_assignment_allowed === true ? { worker_material_assignment_allowed: true } : {}) };
  });
}

/** @v2 _decodeCanonicalSnapshotCache */
export function decodeWorkerQueueCache(value: unknown, session: Session): WorkerQueue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid worker queue cache');
  const raw = value as Record<string, unknown>;
  if (raw.schema !== 1) throw new TypeError('Invalid worker queue cache schema');
  const snapshot = decodeWorkerQueueSnapshot(raw.snapshot, session);
  const catalog = catalogFromCache(raw.apparatus);
  const machines = workerMachinesFromSnapshot(catalog, snapshot, session.assigned_apparatus);
  return queueFromSnapshot(machines, snapshot, session.assigned_apparatus, session.assigned_apparatus_labels, catalog);
}

/** @v2 _ProductionOrdersSnapshotCache */
export class WorkerQueueCache {
  private readonly saves = new Map<string, Save>();
  private readonly versions = new Map<string, number>();
  private generation = 0;
  constructor(private readonly options: Options) {}
  private current(session: Session, scope: string, generation: number, diskGeneration: number): boolean {
    return generation === this.generation && diskGeneration === this.options.snapshots.generation &&
      scope === sessionReadScope(session) && (this.options.current?.(session) ?? !!activeSessionToken(session));
  }
  private id(scope: string, key: string) { return JSON.stringify([scope, key]); }
  private cancel(id: string) {
    const pending = this.saves.get(id);
    if (pending) { clearTimeout(pending.timer); this.saves.delete(id); pending.finish(); }
  }

  /** A slow optional disk read must never delay the canonical network path. */
  async restore(session: Session, limit: QueueLimit, search: string): Promise<WorkerQueue | null> {
    const scope = sessionReadScope(session), key = workerQueueCacheKey(limit, search), id = this.id(scope, key);
    const generation = this.generation, diskGeneration = this.options.snapshots.generation, version = this.versions.get(id);
    const current = () => this.current(session, scope, generation, diskGeneration) && version === this.versions.get(id);
    if (!current()) return null;
    let timer: ReturnType<typeof setTimeout> | undefined, expired = false;
    try {
      return await Promise.race([
        (async () => {
          const saved = await this.options.snapshots.read(scope, key);
          if (expired || !current() || !saved) return null;
          try { return decodeWorkerQueueCache(saved, session); }
          catch {
            if (current()) void this.options.snapshots.remove(scope, key).catch(() => {});
            return null;
          }
        })().catch(() => null),
        new Promise<null>(resolve => { timer = setTimeout(() => { expired = true; resolve(null); }, this.options.restoreTimeoutMs ?? 500); }),
      ]);
    } finally { expired = true; if (timer !== undefined) clearTimeout(timer); }
  }

  /** The page calls this only after canonical validation and pending-write checks. */
  save(session: Session, limit: QueueLimit, search: string, queue: WorkerQueue): Promise<void> {
    const scope = sessionReadScope(session), key = workerQueueCacheKey(limit, search), id = this.id(scope, key);
    const generation = this.generation, diskGeneration = this.options.snapshots.generation;
    if (!this.current(session, scope, generation, diskGeneration)) return Promise.resolve();
    let encoded: string;
    try {
      const saved = { schema: 1, snapshot: queue.snapshot, apparatus: queue.catalog ?? queue.machines };
      decodeWorkerQueueCache(saved, session);
      // Capture immutable data now, before the debounce or an account transition.
      encoded = JSON.stringify(saved);
    } catch { return Promise.resolve(); }
    this.cancel(id);
    const version = (this.versions.get(id) ?? 0) + 1;
    this.versions.set(id, version);
    return new Promise(resolve => {
      let writing: Promise<void> | null = null;
      const flush = (): Promise<void> => {
        if (writing) return writing;
        this.saves.delete(id);
        if (!this.current(session, scope, generation, diskGeneration) || this.versions.get(id) !== version) { resolve(); return Promise.resolve(); }
        writing = this.options.snapshots.writeEncoded(scope, key, encoded, diskGeneration).catch(() => {}).finally(resolve);
        return writing;
      };
      const timer = setTimeout(() => { void flush(); }, this.options.saveDelayMs ?? 400);
      this.saves.set(id, { timer, finish: resolve, flush });
    });
  }

  /** Page exit/background flushes the already captured canonical value. */
  flush(session: Session, limit: QueueLimit, search = ''): Promise<void> {
    const pending = this.saves.get(this.id(sessionReadScope(session), workerQueueCacheKey(limit, search)));
    if (!pending) return Promise.resolve();
    clearTimeout(pending.timer);
    return pending.flush();
  }

  forget(session: Session, limit: QueueLimit, search: string): Promise<void> {
    const scope = sessionReadScope(session), key = workerQueueCacheKey(limit, search), id = this.id(scope, key);
    this.cancel(id); this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
    return this.options.snapshots.remove(scope, key).catch(() => {});
  }
  cancelPending(session: Session, limit: QueueLimit, search = ''): void {
    const id = this.id(sessionReadScope(session), workerQueueCacheKey(limit, search));
    this.cancel(id); this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
  }
  reset(): void {
    this.generation++;
    for (const id of this.saves.keys()) this.cancel(id);
    this.versions.clear();
  }
}

export const workerQueueCache = new WorkerQueueCache({ snapshots: productionSnapshotStore });
export const restoreWorkerQueue = (session: Session, limit: QueueLimit, search = '') => workerQueueCache.restore(session, limit, search);
export const saveWorkerQueue = (session: Session, limit: QueueLimit, search: string, queue: WorkerQueue) => workerQueueCache.save(session, limit, search, queue);
export const forgetWorkerQueue = (session: Session, limit: QueueLimit, search = '') => workerQueueCache.forget(session, limit, search);
export const cancelPendingWorkerQueueSave = (session: Session, limit: QueueLimit, search = '') => workerQueueCache.cancelPending(session, limit, search);
export const flushWorkerQueueSave = (session: Session, limit: QueueLimit, search = '') => workerQueueCache.flush(session, limit, search);
