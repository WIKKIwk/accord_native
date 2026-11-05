import { activeSessionToken, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { WorkerControlException } from './workerControlsApi';
import { adminProductionMapLiveUri, type ProductionMapLiveOptions } from './workerLiveUri';
import { parseProductionMapSnapshotRevisionFromJson } from './workerQueueModels';
import { productionMapDeltaOpFromJson } from './workerSequenceMoveApi';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const fail = (detail: string): never => { throw new WorkerControlException('production_map_snapshot_contract_invalid',
  `Production map navbati server shartnomasiga mos emas: ${detail}`); };
const knownPatchFields = new Set(['worker_list_rows', 'worker_display_states', 'worker_report_prompts', 'worker_pending_report_ids',
  'maps', 'map_order', 'map_order_edit', 'sequences', 'sequence_versions', 'sequence_revisions', 'sequence_positions_by_apparatus',
  'visible_order_ids', 'queue_states', 'stage_states', 'queue_policies', 'queue_action_controls', 'order_controls', 'stage_order_controls',
  'order_statuses', 'frozen_orders_by_apparatus', 'order_customers', 'completed_orders', 'completion_requests', 'completion_request_decisions']);
const parseIntValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const text = String(value ?? ''); return /^[+-]?\d+$/.test(text) ? Number(text) : 0;
};

export function decodeProductionMapLiveMessage(event: Obj, options: { paged?: boolean; stateDelta?: boolean; compact?: boolean }): Obj {
  if (event.ok !== true) {
    const code = String(event.error ?? '').trim();
    throw new WorkerControlException(code || 'production_map_live_failed', `Production map jonli holati olinmadi${code ? `. Server xato kodi: ${code} (HTTP 0)` : ''}. Oynani yangilang va qayta urinib ko‘ring.`);
  }
  const type = event.type == null ? '' : String(event.type);
  if (options.stateDelta && options.compact && (event.protocol !== 'state_delta_v2' ||
      !['state_ready', 'state_resync', 'state_delta'].includes(type))) {
    throw new WorkerControlException('state_delta_v2_unsupported', 'Compact state stream is unavailable.');
  }
  if (options.paged && !['page_ready', 'page_invalidated', 'delta', 'page_window_ready',
    'page_window_delta', 'page_window_checkpoint', 'page_window_resync'].includes(type)) {
    throw new WorkerControlException('paged_live_required', 'Buyurtmalar uchun server yangilanishi kerak.');
  }
  if (type.startsWith('page_window_')) {
    if (!['page_window_ready', 'page_window_delta', 'page_window_checkpoint', 'page_window_resync'].includes(type) ||
        typeof event.window !== 'string' || !event.window || typeof event.epoch !== 'string' || !event.epoch ||
        !Number.isInteger(event.rev) || (event.rev as number) < 0 || typeof event.version !== 'string' || !event.version) return fail('invalid page window event');
    return { ...event };
  }
  if (type === 'page_ready' || type === 'page_invalidated') {
    if (typeof event.epoch !== 'string' || !event.epoch || !Number.isInteger(event.rev) || (event.rev as number) < 0) return fail('invalid page live cursor');
    return { type, epoch: event.epoch, revision: event.rev, ready: type === 'page_ready' };
  }
  if (type === 'state_ready' || type === 'state_resync') {
    const revision = parseProductionMapSnapshotRevisionFromJson(event);
    if (revision == null || typeof event.epoch !== 'string' || !event.epoch) return fail('invalid state cursor');
    return { type, epoch: event.epoch, revision, scope: typeof event.scope === 'string' ? event.scope : '',
      resync: type === 'state_resync' || event.resync === true, recovered: event.recovered === true, recovery_supported: event.recovery_supported === true };
  }
  if (type === 'state_delta') {
    const revision = parseProductionMapSnapshotRevisionFromJson(event), patch = object(event.patch);
    const protocol = event.protocol ?? 'state_delta_v1', base = event.base_rev;
    if (revision == null || !Number.isInteger(base) || (base as number) < 0 || revision < (base as number) ||
        typeof event.epoch !== 'string' || !event.epoch || !patch || !['state_delta_v1', 'state_delta_v2'].includes(String(protocol))) return fail('invalid state delta');
    if (Object.keys(patch).some(key => !knownPatchFields.has(key))) return fail('unknown state patch field');
    if (Object.hasOwn(patch, 'map_order_edit') && (protocol !== 'state_delta_v2' || Object.hasOwn(patch, 'map_order'))) return fail('unnegotiated map order edit');
    return { type, epoch: event.epoch, base_revision: base, revision, patch, scope: typeof event.scope === 'string' ? event.scope : '', protocol };
  }
  if (type === 'delta') {
    if (options.paged && (!Number.isInteger(event.snapshot_rev) || (event.snapshot_rev as number) < 0)) return fail('invalid paged delta cursor');
    return { type, epoch: String(event.epoch ?? ''), apparatus: String(event.apparatus ?? event.canonical_apparatus_id ?? ''),
      base_revision: parseIntValue(event.base_revision), revision: parseIntValue(event.revision),
      version: String(event.version ?? ''), base_version: String(event.base_version ?? ''),
      snapshot_revision: typeof event.snapshot_rev === 'number' ? Math.trunc(event.snapshot_rev) : null,
      ops: Array.isArray(event.ops) ? event.ops.filter(item => object(item)).map(productionMapDeltaOpFromJson) : [] };
  }
  return decodeCanonicalProductionMapSnapshot(event, true);
}

export type ProductionMapLiveStreamOptions = Omit<ProductionMapLiveOptions, 'delta' | 'notificationsOnly'> & { enableDelta?: boolean };

// The full-snapshot decoder is tracked separately before this method receives a V2 completion tag.
export function adminProductionMapLiveStream(session: Session, options: ProductionMapLiveStreamOptions = {}) {
  const token = activeSessionToken(session), scope = sessionReadScope(session), baseUrl = session.baseUrl;
  const current = () => !!token && activeSessionToken(session) === token && sessionReadScope(session) === scope && session.baseUrl === baseUrl;
  return {
    subscribe(onMessage: (message: Obj) => void, onError: (error: unknown) => void, onDone?: () => void): () => void {
      let cancelled = false, done = false, generation = 0, socket: WebSocket | null = null, fallback = false;
      const finish = (error?: unknown) => {
        if (cancelled || done) return;
        done = true;
        const old = socket; socket = null;
        old?.close();
        if (error !== undefined) onError(error); else onDone?.();
      };
      const connect = (compact: boolean) => {
        if (cancelled || done) return;
        if (!current()) { finish(new WorkerControlException('session_changed', 'Session changed while negotiating the live stream.')); return; }
        const activeGeneration = ++generation;
        const url = adminProductionMapLiveUri(baseUrl, token!, { ...options, delta: options.enableDelta ?? true, compactStateDelta: compact });
        let ws: WebSocket;
        try { ws = new WebSocket(url.toString()); }
        catch (error) { finish(error); return; }
        socket = ws;
        ws.onmessage = message => {
          if (cancelled || done || activeGeneration !== generation) return;
          if (!current()) { finish(new WorkerControlException('session_changed', 'Live stream account changed.')); return; }
          let decoded: Obj;
          try {
            const value = object(JSON.parse(String(message.data)));
            if (!value) throw new TypeError('Invalid live event');
            decoded = decodeProductionMapLiveMessage(value, { paged: options.paged, stateDelta: options.stateDelta, compact });
          } catch (error) {
            if (compact && !fallback && error instanceof WorkerControlException && error.code === 'state_delta_v2_unsupported') {
              fallback = true;
              connect(false);
              ws.close();
            } else finish(error);
            return;
          }
          onMessage(decoded);
        };
        ws.onerror = () => { if (!cancelled && activeGeneration === generation) finish(new Error('Production map live connection failed')); };
        ws.onclose = () => { if (!cancelled && activeGeneration === generation) finish(); };
      };
      connect(options.stateDelta === true && (options.compactStateDelta ?? true));
      return () => { cancelled = true; generation++; const old = socket; socket = null; old?.close(); };
    },
  };
}
