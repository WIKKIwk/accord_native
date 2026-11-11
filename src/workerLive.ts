import { AppState, type AppStateStatus } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { applyWorkerDelta, workerSnapshotCursor } from './workerDelta';
import { DEFAULT_QUEUE_LIMIT, type QueueLimit } from './workerQueueLimit';
import { adminProductionMapLiveUri } from './workerLiveUri';
import { sessionReadScope } from './sessionReadScope';
import { applyWorkerLegacyDelta, decodeWorkerLegacySnapshot } from './workerLegacyState';
import { openWorkerLiveSocket, type WorkerLiveSocket } from './workerLiveTransport';
import { workerQueueContractError, workerQueueReadCanRetry, workerQueueReadError } from './workerQueueReadError';

export type WorkerLiveOptions = {
  onReady?: (message: Record<string, unknown>) => void;
  onError?: (error: unknown) => void;
  isCurrent?: () => boolean;
  manageAppState?: boolean;
};
const patchFields = new Set(['worker_list_rows', 'worker_display_states', 'worker_report_prompts', 'worker_pending_report_ids',
  'maps', 'map_order', 'map_order_edit', 'sequences', 'sequence_versions', 'sequence_revisions', 'sequence_positions_by_apparatus',
  'visible_order_ids', 'queue_states', 'stage_states', 'queue_policies', 'queue_action_controls', 'order_controls', 'stage_order_controls',
  'order_statuses', 'frozen_orders_by_apparatus', 'order_customers', 'completed_orders', 'completion_requests', 'completion_request_decisions']);

/** @v2 _runWorkerLiveStream */
export function subscribeWorkerLive(
  session: Session,
  search: string,
  onInvalidate: () => void,
  onConnectionChange?: (connected: boolean) => void,
  getSnapshot?: () => Record<string, unknown> | null,
  onSnapshot?: (snapshot: Record<string, unknown>) => void,
  queueLimit: QueueLimit = DEFAULT_QUEUE_LIMIT,
  options: WorkerLiveOptions = {},
): () => void {
  let stopped = false, terminal = false;
  let foreground = options.manageAppState === false || AppState.currentState !== 'background';
  let socket: WorkerLiveSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let firstMessageTimer: ReturnType<typeof setTimeout> | undefined;
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let protocol: 'state_delta_v2' | 'state_delta_v1' = 'state_delta_v2';
  const readScope = sessionReadScope(session);
  const current = () => !stopped && !terminal && readScope === sessionReadScope(session) &&
    !!activeSessionToken(session) && options.isCurrent?.() !== false;
  const clear = (timer: ReturnType<typeof setTimeout> | undefined) => { if (timer !== undefined) clearTimeout(timer); };
  const detach = () => {
    clear(firstMessageTimer); firstMessageTimer = undefined;
    const old = socket; socket = null; old?.close();
  };
  const invalidate = () => {
    if (notifyTimer !== undefined) return;
    notifyTimer = setTimeout(() => { notifyTimer = undefined; if (foreground && current()) onInvalidate(); }, 100);
  };
  const reconnect = () => {
    if (!foreground || !current() || retryTimer !== undefined) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
    retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay * (0.5 + Math.random() * 0.5));
  };
  const failed = (ws: WorkerLiveSocket | null, error: unknown) => {
    if (ws !== socket || !current()) { if (ws === socket) detach(); return; }
    detach();
    const canRetry = workerQueueReadCanRetry(error);
    onConnectionChange?.(false);
    if (!stopped && options.isCurrent?.() !== false) options.onError?.(error);
    if (!canRetry) { terminal = true; clear(notifyTimer); notifyTimer = undefined; return; }
    reconnect();
  };
  const connect = () => {
    if (!foreground || !current() || socket) return;
    const token = activeSessionToken(session);
    if (!token) return;
    const cursor = workerSnapshotCursor(getSnapshot?.());
    const url = adminProductionMapLiveUri(session.baseUrl, token, { stateDelta: true,
      compactStateDelta: protocol === 'state_delta_v2', workerScope: true, queueLimit, queueSearch: search,
      epoch: cursor?.epoch ?? '', scope: cursor?.scope ?? '', revision: cursor?.rev });
    let ws: WorkerLiveSocket;
    try { ws = openWorkerLiveSocket(session, url.toString()); }
    catch (error) { failed(null, error); return; }
    socket = ws;
    firstMessageTimer = setTimeout(() => {
      const error = new Error('First production snapshot timed out'); error.name = 'TimeoutError'; failed(ws, error);
    }, 10000);
    ws.onmessage = event => {
      if (socket !== ws) return;
      if (!current()) { detach(); return; }
      let message: Record<string, unknown>;
      try {
        const value = JSON.parse(String(event.data));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid production live event');
        message = value;
        if (message.ok !== true) {
          if (protocol === 'state_delta_v2' && message.error === 'state_delta_v2_unsupported') {
            protocol = 'state_delta_v1'; detach(); connect(); return;
          }
          throw workerQueueReadError(0, message, 'live');
        }
        if (protocol === 'state_delta_v2' && (message.protocol !== 'state_delta_v2' ||
          !['state_ready', 'state_resync', 'state_delta'].includes(String(message.type ?? '')))) {
          protocol = 'state_delta_v1'; detach(); connect(); return;
        }
        if (['state_ready', 'state_resync', 'state_delta'].includes(String(message.type ?? ''))) {
          if (typeof message.epoch !== 'string' || !message.epoch || !Number.isSafeInteger(message.rev) || (message.rev as number) < 0 ||
            (message.type === 'state_delta' && (!Number.isSafeInteger(message.base_rev) || (message.base_rev as number) < 0 ||
              (message.rev as number) < (message.base_rev as number) || !message.patch || typeof message.patch !== 'object' || Array.isArray(message.patch)))) {
            throw workerQueueContractError('invalid live cursor');
          }
          if (message.type === 'state_delta') {
            const patch = message.patch as Record<string, unknown>, wireProtocol = message.protocol ?? 'state_delta_v1';
            if (!['state_delta_v1', 'state_delta_v2'].includes(String(wireProtocol)) || Object.keys(patch).some(key => !patchFields.has(key)) ||
              (Object.hasOwn(patch, 'map_order_edit') && (wireProtocol !== 'state_delta_v2' || Object.hasOwn(patch, 'map_order')))) {
              throw workerQueueContractError('invalid state delta protocol or patch field');
            }
            message = { ...message, protocol: wireProtocol };
          }
        } else if (protocol === 'state_delta_v1' && message.type === 'delta') {
          clear(firstMessageTimer); firstMessageTimer = undefined; attempts = 0;
          onConnectionChange?.(true); if (current()) invalidate(); return;
        } else if (protocol === 'state_delta_v1') {
          const snapshot = decodeWorkerLegacySnapshot(message, session);
          clear(firstMessageTimer); firstMessageTimer = undefined; attempts = 0;
          onConnectionChange?.(true);
          if (current()) onSnapshot?.(snapshot);
          return;
        }
      } catch (error) { failed(ws, error); return; }
      clear(firstMessageTimer); firstMessageTimer = undefined; attempts = 0;
      onConnectionChange?.(true);
      if (!current()) { detach(); return; }
      if (message.type === 'state_delta') {
        const snapshot = getSnapshot?.(), cursor = workerSnapshotCursor(snapshot);
        if (cursor && cursor.epoch === message.epoch && cursor.scope === (message.scope ?? '') && (message.rev as number) <= cursor.rev) return;
        const next = protocol === 'state_delta_v2' ? applyWorkerDelta(snapshot, message) : applyWorkerLegacyDelta(snapshot, message, session);
        if (next && onSnapshot) onSnapshot(next); else invalidate();
      } else {
        const cursor = workerSnapshotCursor(getSnapshot?.());
        const ready: Record<string, unknown> = { ...message, scope: typeof message.scope === 'string' ? message.scope : '',
          resync: message.type === 'state_resync' || message.resync === true };
        if (!cursor || cursor.epoch !== ready.epoch || cursor.scope !== ready.scope || cursor.rev !== ready.rev || ready.resync) invalidate();
        else options.onReady?.(ready);
      }
    };
    ws.onerror = event => failed(ws, event?.error ?? new Error('Production map live connection failed'));
    ws.onclose = () => failed(ws, new Error('Live connection closed'));
  };
  const onAppState = (state: AppStateStatus) => {
    if (state === 'inactive') return;
    const next = state === 'active';
    if (next === foreground) return;
    foreground = next;
    if (!next) {
      clear(retryTimer); retryTimer = undefined;
      clear(notifyTimer); notifyTimer = undefined; detach();
      onConnectionChange?.(false);
    } else { attempts = 0; connect(); }
  };
  const subscription = options.manageAppState === false ? null : AppState.addEventListener('change', onAppState);
  connect();
  return () => {
    stopped = true;
    clear(retryTimer); clear(notifyTimer); detach(); subscription?.remove();
  };
}
