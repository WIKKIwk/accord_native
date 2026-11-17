import { productionLiveNativeModule, type NativeProductionSocketEvent } from '../../modules/accord-production-live/src/AccordProductionLiveModule';
import { activeSessionToken, registerSessionResetHook, subscribeSessionWitness, type Session } from '../auth';
import { dartTrim } from '../admin/dartJsonString';
import { dartQueryComponent } from '../admin/dartUri';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { InventoryViewQuery } from '../shared/inventoryViewQuery';
import type { InventoryLiveHandlers } from '../shared/inventoryViewStore';

/** @v2 InventoryViewStore._openLive */
export function brigaderInventoryLiveUri(session: Session, query: InventoryViewQuery, version: string | null): string {
  const token = dartTrim(activeSessionToken(session) ?? '');
  if (!token || session.token === 'test-mode-token') throw new Error('No inventory live session token');
  const origin = new URL(session.baseUrl);
  if (origin.protocol !== 'https:' || origin.origin !== session.baseUrl || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid inventory live origin');
  const subscriptions = JSON.stringify([query.subscription(version)]);
  return `wss://${origin.host}/v1/mobile/admin/inventory/live?token=${dartQueryComponent(token)}&subscriptions=${dartQueryComponent(subscriptions)}`;
}

type Timers = { schedule(callback: () => void, delay: number): unknown; cancel(handle: unknown): void };
const timers: Timers = { schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/** @v2 connectWarehouseLivePlatform
 * InventoryViewStore owns retries, first-message/heartbeat deadlines and baseline
 * repair. This adapter owns one native socket and the source10s upgrade deadline. */
export function subscribeBrigaderInventoryLive(session: Session, query: InventoryViewQuery, version: string | null,
  isCurrent: () => boolean, handlers: InventoryLiveHandlers, clock: Timers = timers): () => void {
  if (!isSynchronouslyTrue(isCurrent)) throw new Error('Inventory live session changed');
  const uri = brigaderInventoryLiveUri(session, query, version), native = productionLiveNativeModule();
  if (!native || typeof native.openInventory !== 'function') throw new Error('Inventory live native transport unavailable');
  let id: string | null = null, stoppedId: string | null = null, closed = false, opening = true, opened = false;
  let subscription: { remove(): void } | undefined, unsubscribe = () => {}, unregister = () => {}, handshake: unknown = null;
  const queued: NativeProductionSocketEvent[] = [];
  const cancelHandshake = () => { const handle = handshake; handshake = null; if (handle !== null) clock.cancel(handle); };
  const stop = () => {
    closed = true; cancelHandshake(); queued.length = 0;
    subscription?.remove(); subscription = undefined;
    unsubscribe(); unsubscribe = () => {}; unregister(); unregister = () => {};
    if (id !== null && stoppedId !== id) { stoppedId = id; try { native.stop(id); } catch { /* Native teardown owns a removed connection. */ } }
  };
  const current = () => {
    try { return isSynchronouslyTrue(isCurrent) && brigaderInventoryLiveUri(session, query, version) === uri; }
    catch { return false; }
  };
  const valid = () => { if (closed) return false; if (!current()) { stop(); return false; } return true; };
  const end = (failed: boolean) => {
    if (!valid()) return;
    stop();
    try { if (failed && current()) handlers.error(new Error('Inventory live transport failed')); }
    finally { if (current()) handlers.done(); }
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
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid inventory live map');
    } catch { end(true); return; }
    if (valid()) handlers.message(value as Record<string, unknown>);
  };
  try {
    subscription = native.addListener('onProductionSocket', receive);
    unsubscribe = subscribeSessionWitness(() => { valid(); });
    unregister = registerSessionResetHook(async () => { stop(); });
    if (!valid()) throw new Error('Inventory live session changed');
    handshake = clock.schedule(() => { handshake = null; end(true); }, 10_000);
    if (!valid()) throw new Error('Inventory live session changed');
    id = native.openInventory(session.baseUrl, uri); opening = false;
    if (!valid()) { stop(); return stop; }
    for (const event of queued.splice(0)) receive(event);
    return stop;
  } catch (error) { opening = false; stop(); throw error; }
}
