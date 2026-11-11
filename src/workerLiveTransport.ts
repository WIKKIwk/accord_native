import { productionLiveNativeModule, type NativeProductionSocketEvent } from '../modules/accord-production-live/src/AccordProductionLiveModule';
import { activeSessionToken, registerSessionResetHook, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { workerQueueReadError } from './workerQueueReadError';

export type WorkerLiveSocket = {
  readonly readyState: number;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { error?: unknown }) => void) | null;
  onclose: (() => void) | null;
  close(): void;
};
const allowed = new Set(['token', 'protocol', 'worker_scope', 'projection', 'queue_limit', 'queue_positions', 'queue_search', 'epoch', 'scope', 'rev']);

export function workerLiveDestination(session: Session, rawUrl: string): string {
  const token = activeSessionToken(session), base = new URL(session.baseUrl), target = new URL(rawUrl);
  const keys = [...target.searchParams.keys()];
  if (!token || base.protocol !== 'https:' || base.origin !== session.baseUrl || base.username || base.password ||
    base.pathname !== '/' || base.search || base.hash || target.protocol !== 'wss:' || target.host !== base.host ||
    target.username || target.password || target.hash || target.pathname !== '/v1/mobile/admin/production-maps/live' ||
    target.searchParams.get('token') !== token || keys.some(key => !allowed.has(key)) || new Set(keys).size !== keys.length) {
    throw new Error('Invalid production live destination');
  }
  return target.toString();
}

/** @v2 connectWarehouseLivePlatform: native transport owns RFC ping/pong every 25s. */
export function openWorkerLiveSocket(session: Session, rawUrl: string): WorkerLiveSocket {
  const url = workerLiveDestination(session, rawUrl), native = productionLiveNativeModule();
  // Expo Go and an older development binary retain their actual RN connection.
  // Its heartbeat is not equivalent to the native ping/pong transport above.
  if (!native) return new WebSocket(url) as unknown as WorkerLiveSocket;
  const token = activeSessionToken(session), scope = sessionReadScope(session);
  let id: string | null = null, closed = false, state = 0;
  let subscription: { remove(): void } | undefined, unregister = () => {};
  const current = () => activeSessionToken(session) === token && sessionReadScope(session) === scope;
  const socket: WorkerLiveSocket = {
    get readyState() { return state; }, onmessage: null, onerror: null, onclose: null,
    close() {
      if (closed) return;
      closed = true; state = 3; subscription?.remove(); unregister();
      if (id) { try { native.stop(id); } catch { /* Module teardown already stopped the socket. */ } }
      void Promise.resolve().then(() => socket.onclose?.());
    },
  };
  const event = (value: NativeProductionSocketEvent) => {
    if (closed || value.session !== id) return;
    if (!current()) { socket.close(); return; }
    if (value.type === 'open') state = 1;
    else if (value.type === 'message' && state === 1) socket.onmessage?.({ data: value.value });
    else if (value.type === 'error') socket.onerror?.({ error: value.statusCode
      ? workerQueueReadError(value.statusCode, null, 'live-http') : new Error('Production map live connection failed') });
    else if (value.type === 'close') socket.close();
  };
  try {
    subscription = native.addListener('onProductionSocket', event);
    unregister = registerSessionResetHook(async () => { socket.close(); });
    id = native.open(session.baseUrl, url);
  } catch {
    socket.close();
    throw new Error('Production map live connection failed');
  }
  return socket;
}
