import { apparatusToJson } from '../apparatusApi';
import { activeSessionToken, sessionWitnessVersion, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { productionSnapshotStore } from '../shared/productionSnapshotRuntime';
import { readSupplyTaskWindow } from '../shared/supplyTasks/supplyTaskApi';
import { supplyTaskWindowFromJson, type SupplyTaskWindow } from '../shared/supplyTasks/supplyTaskModels';
/** @v2 SupplyTasksWarmStore */
class QolipTasksWarmStore {
  private owner = ''; private windows = new Map<string, SupplyTaskWindow>(); private pending = new Map<string, Promise<SupplyTaskWindow>>();
  private serials = new Map<string, number>(); private generation = 0; private denied = false; private prepared = false;
  private scope(session: Session) { return JSON.stringify([sessionReadScope(session), activeSessionToken(session), sessionWitnessVersion(), productionSnapshotStore.generation]); }
  private synchronize(session: Session) { const owner = this.scope(session); if (owner !== this.owner) { this.owner = owner; this.generation++; this.windows.clear(); this.pending.clear(); this.serials.clear(); this.denied = false; this.prepared = false; } }
  private key(apparatus: string, limit: number, search: string) { return JSON.stringify(['supply-tasks-v1', 'qolip', apparatus, limit, search.trim().toLowerCase()]); }
  async prepare(session: Session, current: () => boolean, selection: () => Promise<string | null>) {
    this.synchronize(session); if (this.prepared || !current()) return; this.prepared = true;
    try { const apparatus = await selection(); if (current()) await this.read(session, { apparatus: apparatus ?? '', limit: 10, search: '' }, current); } catch { /* Optional one-shot role preload; page retries a failure. */ }
  }
  remember(session: Session, window: SupplyTaskWindow, aliases: string[] = []) {
    this.synchronize(session); const key = this.key(window.apparatus_id, window.limit, window.search), previous = this.windows.get(key);
    if (previous?.epoch === window.epoch && previous.revision > window.revision) return;
    this.denied = false;
    for (const alias of new Set([key, ...aliases, ...[...this.windows].filter(([, old]) => old.apparatus_id === window.apparatus_id && old.limit === window.limit && old.search === window.search).map(([id]) => id)])) {
      const old = this.windows.get(alias); this.windows.delete(alias); this.windows.set(alias, window);
      if (old?.version !== window.version || old.epoch !== window.epoch || old.scope !== window.scope) {
        const raw = { ok: true, projection: 'supply_tasks_v1', ...window, rev: window.revision, apparatus: window.apparatus.map(apparatusToJson) };
        void productionSnapshotStore.write(sessionReadScope(session), alias, { schema: 1, window: raw });
      }
    }
    while (this.windows.size > 8) this.windows.delete(this.windows.keys().next().value!);
  }
  invalidate(session: Session) {
    this.synchronize(session); this.generation++; this.pending.clear(); this.serials.clear(); this.denied = true;
    for (const key of new Set([this.key('', 10, ''), ...this.windows.keys()])) void productionSnapshotStore.remove(sessionReadScope(session), key);
    this.windows.clear();
  }
  read(session: Session, query: { apparatus: string; limit: number; search: string }, current: () => boolean, fresh = false): Promise<SupplyTaskWindow> {
    this.synchronize(session); const owner = this.owner, generation = this.generation, key = this.key(query.apparatus, query.limit, query.search), skip = fresh || this.denied;
    if (!skip && this.windows.has(key) && current()) return Promise.resolve(this.windows.get(key)!);
    const pendingKey = key + ':' + fresh, pending = this.pending.get(pendingKey); if (pending) return pending.then(window => { if (!current()) throw new Error('Hisob o‘zgardi.'); return window; });
    const serial = (this.serials.get(key) ?? 0) + 1; this.serials.set(key, serial);
    const guard = () => current() && generation === this.generation && owner === this.scope(session) && this.serials.get(key) === serial;
    const requireCurrent = () => { if (!guard()) throw new Error('Vazifalar hisob doirasi o‘zgardi.'); };
    const operation = (async () => {
      try {
        if (!skip) {
          const saved = await productionSnapshotStore.read(sessionReadScope(session), key); requireCurrent();
          if (saved) { try { if (saved.schema !== 1) throw new TypeError(); const window = supplyTaskWindowFromJson(saved.window);
            if (window.kind !== 'qolip' || window.limit !== query.limit || window.search !== query.search.trim().toLowerCase()) throw new TypeError();
            this.remember(session, window, [key]); return window;
          } catch { void productionSnapshotStore.remove(sessionReadScope(session), key); } }
        }
        requireCurrent(); const window = await readSupplyTaskWindow(session, { kind: 'qolip', ...query }, guard); requireCurrent(); this.remember(session, window, [key]); return window;
      } catch (error) { const e = error as { statusCode?: number; code?: string }; if (guard() && ([401,403].includes(e.statusCode ?? 0) || ['unauthorized','forbidden'].includes(e.code ?? ''))) this.invalidate(session); throw error; }
    })().finally(() => { if (this.pending.get(pendingKey) === operation) this.pending.delete(pendingKey); });
    this.pending.set(pendingKey, operation); return operation;
  }
}
export const qolipTasksWarmStore = new QolipTasksWarmStore();
