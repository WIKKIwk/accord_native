import { productionLiveNativeModule, type NativeProductionSocketEvent } from '../../modules/accord-production-live/src/AccordProductionLiveModule';
import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, registerSessionResetHook, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { dartQueryComponent } from './dartUri';
import { dartTrim } from './dartJsonString';

/** @v2 adminWarehouseLiveUri */
export function adminWarehouseLiveUri(session: Session): string {
  const token = dartTrim(activeSessionToken(session) ?? '');
  if (!token) throw new Error('No session token');
  const base = new URL(session.baseUrl);
  if (base.protocol !== 'https:' || base.origin !== session.baseUrl || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('Invalid warehouse live origin');
  }
  return `wss://${base.host}/v1/mobile/admin/warehouses/live?token=${dartQueryComponent(token)}`;
}

export function adminWarehouseLiveCurrent(session: Session, witness: SessionWitness, isCurrent: () => boolean): () => boolean {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let retired = false, checking = false;
  return () => {
    if (retired || checking) { retired = true; return false; }
    checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) &&
        session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
        sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminWarehouses);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true;
      return !retired;
    } catch { retired = true; return false; }
    finally { checking = false; }
  };
}

export type AdminWarehouseLiveCallbacks = { message: (value: Record<string, unknown>) => void; error: () => void; done: () => void };
export type AdminWarehouseLiveConnection = { stop: () => void };
type LiveTimers = { schedule: (callback: () => void, delay: number) => unknown; cancel: (handle: unknown) => void };
const liveTimers: LiveTimers = { schedule: (callback, delay) => setTimeout(callback, delay), cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/** @v2 adminWarehouseLiveEvents
 * The dedicated native endpoint retains cookie/credential/redirect isolation and protocol ping/pong. */
export function openAdminWarehouseLive(session: Session, current: () => boolean, callbacks: AdminWarehouseLiveCallbacks, timers: LiveTimers = liveTimers): AdminWarehouseLiveConnection {
  if (!isSynchronouslyTrue(current)) throw new Error('Warehouse live session changed');
  const uri = adminWarehouseLiveUri(session), native = productionLiveNativeModule();
  if (!native || typeof native.openWarehouse !== 'function') throw new Error('Warehouse live native transport unavailable');
  let id: string | null = null, stoppedId: string | null = null, closed = false, opening = true, opened = false;
  let subscription: { remove(): void } | undefined;
  let unsubscribe = () => {}, unregister = () => {};
  let handshakeTimer: unknown = null;
  const queued: NativeProductionSocketEvent[] = [];
  const cancelHandshake = () => { const timer = handshakeTimer; handshakeTimer = null; if (timer !== null) timers.cancel(timer); };
  const stop = () => {
    if (!closed) { closed = true; cancelHandshake(); queued.length = 0; subscription?.remove(); unsubscribe(); unregister(); }
    if (id !== null && stoppedId !== id) {
      stoppedId = id;
      try { native.stop(id); } catch { /* Native teardown already owns the connection. */ }
    }
  };
  const valid = () => {
    if (closed) return false;
    if (!isSynchronouslyTrue(current)) { stop(); return false; }
    return true;
  };
  const end = (failed: boolean) => {
    if (!valid()) return;
    stop();
    try { if (failed && isSynchronouslyTrue(current)) callbacks.error(); }
    finally { if (isSynchronouslyTrue(current)) callbacks.done(); }
  };
  const receive = (event: NativeProductionSocketEvent) => {
    if (opening) { queued.push(event); return; }
    if (event.session !== id || !valid()) return;
    if (event.type === 'open') { opened = true; cancelHandshake(); return; }
    if (event.type === 'error') { end(true); return; }
    if (event.type === 'close') { end(false); return; }
    if (event.type !== 'message' || !opened || typeof event.value !== 'string') return;
    let value: unknown;
    try {
      value = JSON.parse(event.value);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid warehouse live map');
    } catch { end(true); return; }
    if (valid()) callbacks.message(value as Record<string, unknown>);
  };
  try {
    subscription = native.addListener('onProductionSocket', receive);
    unsubscribe = subscribeSessionWitness(() => { valid(); });
    unregister = registerSessionResetHook(async () => { stop(); });
    if (!valid() || adminWarehouseLiveUri(session) !== uri) throw new Error('Warehouse live session changed');
    // Source WebSocket.connect.timeout bounds the entire setup, including a slowly streamed upgrade.
    handshakeTimer = timers.schedule(() => { handshakeTimer = null; end(true); }, 10_000);
    if (!valid()) throw new Error('Warehouse live session changed');
    id = native.openWarehouse(session.baseUrl, uri);
    opening = false;
    if (!valid()) { stop(); return { stop }; }
    for (const event of queued.splice(0)) receive(event);
    return { stop };
  } catch (error) { opening = false; stop(); throw error; }
}
