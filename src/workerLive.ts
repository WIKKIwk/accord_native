import { AppState, type AppStateStatus } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { applyWorkerDelta, workerSnapshotCursor } from './workerDelta';
import { DEFAULT_QUEUE_LIMIT, type QueueLimit } from './workerQueueLimit';
import { adminProductionMapLiveUri } from './workerLiveUri';
import { sessionReadScope } from './sessionReadScope';

/** Invalidate the worker's HTTP snapshot when the server's scoped stream changes. */
export function subscribeWorkerLive(
  session: Session,
  search: string,
  onInvalidate: () => void,
  onConnectionChange?: (connected: boolean) => void,
  getSnapshot?: () => Record<string, unknown> | null,
  onSnapshot?: (snapshot: Record<string, unknown>) => void,
  queueLimit: QueueLimit = DEFAULT_QUEUE_LIMIT,
): () => void {
  let stopped = false;
  let foreground = AppState.currentState !== 'background';
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let firstMessageTimer: ReturnType<typeof setTimeout> | undefined;
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let protocol: 'state_delta_v2' | 'state_delta_v1' = 'state_delta_v2';
  const readScope = sessionReadScope(session);
  const current = () => readScope === sessionReadScope(session) && !!activeSessionToken(session);

  const clear = (timer: ReturnType<typeof setTimeout> | undefined) => {
    if (timer !== undefined) clearTimeout(timer);
  };
  const invalidate = () => {
    clear(notifyTimer);
    notifyTimer = setTimeout(() => { if (!stopped && foreground && current()) onInvalidate(); }, 100);
  };
  const reconnect = () => {
    if (stopped || !foreground || !current() || retryTimer !== undefined) return;
    onConnectionChange?.(false);
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
    retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay * (0.5 + Math.random() * 0.5));
  };
  const connect = () => {
    if (stopped || !foreground || !current() || socket) return;
    const token = activeSessionToken(session);
    if (!token) return;
    const cursor = workerSnapshotCursor(getSnapshot?.());
    const base = adminProductionMapLiveUri(session.baseUrl, token, { stateDelta: true,
      compactStateDelta: protocol === 'state_delta_v2', workerScope: true, queueLimit, queueSearch: search,
      epoch: cursor?.epoch ?? '', scope: cursor?.scope ?? '', revision: cursor?.rev });
    let ws: WebSocket;
    try { ws = new WebSocket(base.toString()); }
    catch { reconnect(); return; }
    socket = ws;
    firstMessageTimer = setTimeout(() => { if (socket === ws) ws.close(); }, 10000);
    ws.onmessage = event => {
      if (stopped || socket !== ws) return;
      if (!current()) { ws.close(); return; }
      let message: Record<string, unknown>;
      try { message = JSON.parse(String(event.data)); } catch { ws.close(); return; }
      if (message.ok !== true) { ws.close(); return; }
      if (protocol === 'state_delta_v2' && (message.protocol !== 'state_delta_v2' || !['state_ready', 'state_resync', 'state_delta'].includes(String(message.type ?? '')))) {
        protocol = 'state_delta_v1';
        ws.close();
        return;
      }
      if (!['state_ready', 'state_resync', 'state_delta'].includes(String(message.type ?? ''))) { ws.close(); return; }
      clear(firstMessageTimer);
      firstMessageTimer = undefined;
      attempts = 0;
      onConnectionChange?.(true);
      if (message.type === 'state_delta' && protocol === 'state_delta_v2' && getSnapshot && onSnapshot) {
        const currentCursor = workerSnapshotCursor(getSnapshot());
        if (currentCursor && currentCursor.epoch === message.epoch && currentCursor.scope === message.scope &&
            typeof message.rev === 'number' && message.rev <= currentCursor.rev) return;
        const next = applyWorkerDelta(getSnapshot(), message);
        if (next) onSnapshot(next);
        else invalidate();
      } else if (message.type === 'state_ready' && protocol === 'state_delta_v2') {
        const current = workerSnapshotCursor(getSnapshot?.());
        if (!current || current.epoch !== message.epoch || current.scope !== message.scope || current.rev !== message.rev || message.resync === true) invalidate();
      } else {
        invalidate();
      }
    };
    ws.onerror = () => { if (socket === ws) ws.close(); };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      clear(firstMessageTimer);
      firstMessageTimer = undefined;
      reconnect();
    };
  };
  const onAppState = (state: AppStateStatus) => {
    const next = state === 'active';
    if (next === foreground) return;
    foreground = next;
    if (!next) {
      clear(retryTimer); retryTimer = undefined;
      clear(firstMessageTimer); firstMessageTimer = undefined;
      clear(notifyTimer); notifyTimer = undefined;
      const old = socket; socket = null; old?.close();
      onConnectionChange?.(false);
    } else { attempts = 0; connect(); }
  };
  const subscription = AppState.addEventListener('change', onAppState);
  connect();
  return () => {
    stopped = true;
    clear(retryTimer); clear(firstMessageTimer); clear(notifyTimer);
    subscription.remove();
    const old = socket; socket = null; old?.close();
  };
}
