import { parseSupplyTaskJson } from '../shared/supplyTasks/supplyTaskJson';
import { productionLiveNativeModule, type NativeProductionSocketEvent } from '../../modules/accord-production-live/src/AccordProductionLiveModule';
import { activeSessionToken, type Session } from '../auth';
import { supplyTaskMessageFromJson, type SupplyTaskMessage, type SupplyTaskWindow } from '../shared/supplyTasks/supplyTaskModels';
import { MobileApiException } from '../shared/mobileApiException';
/** @v2 supplyTaskLive */
export function subscribeQolipTasksLive(session: Session, baseline: SupplyTaskWindow, current: () => boolean,
  message: (event: SupplyTaskMessage) => void, error: (error: unknown) => void, done: () => void): () => void {
  const url = new URL('/v1/mobile/production-tasks/live', session.baseUrl); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({ kind: 'qolip', apparatus: baseline.apparatus_id, limit: String(baseline.limit), search: baseline.search,
    token: activeSessionToken(session) ?? '', epoch: baseline.epoch, rev: String(baseline.revision), scope: baseline.scope }).toString();
  let closed = false, socket: WebSocket | null = null, id: string | null = null;
  const receive = (raw: unknown) => { if (!closed && current()) { try { message(supplyTaskMessageFromJson(parseSupplyTaskJson(String(raw)))); } catch (reason) { error(reason); } } };
  const native = productionLiveNativeModule();
  let remove = () => {};
  if (native?.openSupplyTasks) {
    let starting = true;
    const pending: NativeProductionSocketEvent[] = [];
    const dispatch = (event: NativeProductionSocketEvent) => {
      if (closed || event.session !== id || !current()) return;
      if (event.type === 'message') receive(event.value);
      else if (event.type === 'error') error(new MobileApiException({ code: event.statusCode === 401 ? 'unauthorized' : event.statusCode === 403 ? 'forbidden' : 'live_failed', statusCode: event.statusCode, message: event.value }));
      else if (event.type === 'close') done();
    };
    const subscription = native.addListener('onProductionSocket', event => { if (starting) pending.push(event); else dispatch(event); });
    remove = () => subscription.remove();
    try {
      if (!current()) throw new Error('Hisob o‘zgardi.');
      id = native.openSupplyTasks(session.baseUrl, url.toString()); starting = false;
      if (!current()) { closed = true; remove(); native.stop(id); }
      else for (const event of pending) dispatch(event);
    } catch (reason) { starting = false; remove(); if (current()) error(reason); }
  } else {
    // Older development binaries retain the real JS socket; protocol ping parity needs the new native build.
    try { if (!current()) throw new Error('Hisob o‘zgardi.'); socket = new WebSocket(url.toString());
      socket.onmessage = event => receive(event.data);
      socket.onerror = event => { if (!closed && current()) error(event); };
      socket.onclose = () => { if (!closed && current()) done(); };
      if (!current()) { closed = true; socket.close(); }
    } catch (reason) { if (current()) error(reason); }
  }
  return () => { if (closed) return; closed = true; remove(); if (id) native?.stop(id); socket?.close(); };
}
