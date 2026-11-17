import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { apparatusToJson } from '../apparatusApi';
import { sessionReadScope } from '../sessionReadScope';
import type { ProductionSnapshotStore } from '../shared/productionSnapshotStore';
import type { SupplyTasksQuery } from '../shared/supplyTasks/SupplyTasksController';
import { supplyTaskWindowFromJson, type SupplyTaskWindow } from '../shared/supplyTasks/supplyTaskModels';

const keyFor = (query: SupplyTasksQuery) => JSON.stringify(['supply-tasks-v1', query.kind, query.apparatus, query.limit, query.search.trim().toLowerCase()]);
export function materialTaskWindowJson(window: SupplyTaskWindow) {
  return { ok: true, projection: 'supply_tasks_v1', kind: window.kind, scope: window.scope, epoch: window.epoch, rev: window.revision,
    version: window.version, apparatus_id: window.apparatus_id, limit: window.limit, search: window.search, checked_count: window.checked_count,
    missing_count: window.missing_count, rows: window.rows, apparatus: window.apparatus.map(apparatusToJson) };
}

/** @v2 SupplyTasksWarmStore */
export class MaterialTasksWarmStore {
  private owner = '';
  private windows = new Map<string, SupplyTaskWindow>();
  private pending = new Map<string, Promise<SupplyTaskWindow>>();
  private serials = new Map<string, number>();
  private denied = false;
  private generation = 0;
  constructor(private readonly session: Session, private readonly snapshots: ProductionSnapshotStore,
    private readonly load: (query: SupplyTasksQuery, current: () => boolean) => Promise<SupplyTaskWindow>, private readonly isCurrent: () => boolean) {}
  private synchronize() {
    const owner = JSON.stringify([sessionReadScope(this.session), activeSessionEpoch(this.session), activeSessionToken(this.session), this.snapshots.generation]);
    if (owner === this.owner) return;
    this.reset(); this.owner = owner;
  }
  read(query: SupplyTasksQuery, current: () => boolean, fresh = false): Promise<SupplyTaskWindow> {
    this.synchronize();
    const key = keyFor(query), pendingKey = `${key}:${fresh}`, existing = this.pending.get(pendingKey);
    if (!fresh && !this.denied && this.windows.has(key)) return Promise.resolve(this.windows.get(key)!);
    if (existing) return existing.then(value => { if (!current() || !this.isCurrent()) throw new Error('Hisob o‘zgardi.'); return value; });
    const generation = this.generation, scope = sessionReadScope(this.session), serial = (this.serials.get(key) ?? 0) + 1;
    this.serials.set(key, serial);
    const valid = () => current() && this.isCurrent() && generation === this.generation && this.serials.get(key) === serial;
    const guard = () => { this.synchronize(); if (!valid()) throw new Error('Vazifalar hisob doirasi o‘zgardi.'); };
    let pending: Promise<SupplyTaskWindow>;
    pending = (async () => {
      try {
        if (!fresh && !this.denied) {
          const saved = await this.snapshots.read(scope, key); guard();
          if (saved) {
            try {
              if (saved.schema !== 1) throw new TypeError('Invalid saved window');
              const window = supplyTaskWindowFromJson(saved.window);
              if (window.kind !== query.kind || window.limit !== query.limit || window.search !== query.search.trim().toLowerCase()) throw new TypeError('Mismatched saved window');
              this.remember(window, [key]); return window;
            } catch { void this.snapshots.remove(scope, key); }
          }
        }
        guard(); const window = await this.load(query, valid); guard(); this.remember(window, [key]); return window;
      } catch (error) {
        const value = error as { statusCode?: number; code?: string };
        if (valid() && (value?.statusCode === 401 || value?.statusCode === 403 || ['unauthorized', 'forbidden'].includes(value?.code ?? ''))) this.invalidate();
        throw error;
      }
    })().finally(() => { if (this.pending.get(pendingKey) === pending) this.pending.delete(pendingKey); });
    this.pending.set(pendingKey, pending); return pending;
  }
  remember(window: SupplyTaskWindow, aliases: string[] = []) {
    this.synchronize(); if (!this.isCurrent()) return;
    const key = keyFor({ kind: window.kind, apparatus: window.apparatus_id, limit: window.limit, search: window.search });
    const previous = this.windows.get(key);
    if (previous?.epoch === window.epoch && previous.revision > window.revision) return;
    const keys = new Set([key, ...aliases, ...[...this.windows].filter(([, value]) => value.kind === window.kind && value.apparatus_id === window.apparatus_id &&
      value.limit === window.limit && value.search === window.search).map(([alias]) => alias)]);
    this.denied = false;
    for (const alias of keys) {
      const old = this.windows.get(alias); this.windows.delete(alias); this.windows.set(alias, window);
      if (old?.version !== window.version || old.epoch !== window.epoch || old.scope !== window.scope)
        void this.snapshots.write(sessionReadScope(this.session), alias, { schema: 1, window: materialTaskWindowJson(window) });
    }
    while (this.windows.size > 8) this.windows.delete(this.windows.keys().next().value!);
  }
  invalidate() {
    this.synchronize(); this.generation++; this.pending.clear(); this.serials.clear(); this.denied = true;
    const keys = new Set([keyFor({ kind: 'material', apparatus: '', limit: 10, search: '' }), ...this.windows.keys()]);
    this.windows.clear(); for (const key of keys) void this.snapshots.remove(sessionReadScope(this.session), key);
  }
  reset() { this.generation++; this.windows.clear(); this.pending.clear(); this.serials.clear(); this.owner = ''; this.denied = false; }
}
