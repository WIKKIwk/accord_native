import { productionLiveNativeModule, type NativeProductionSocketEvent } from '../../modules/accord-production-live/src/AccordProductionLiveModule';
import { activeSessionToken, type Session } from '../auth';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { applySupplyTaskMessage, supplyTaskMessageFromJson, type SupplyTaskWindow } from '../shared/supplyTasks/supplyTaskModels';
import { parseSupplyTaskJson } from '../shared/supplyTasks/supplyTaskJson';

/** @v2 supplyTaskLive */
export function materialTaskLiveUrl(session: Session, window: SupplyTaskWindow) {
  const token = activeSessionToken(session), url = new URL(session.baseUrl);
  if (!token || url.protocol !== 'https:' || url.origin !== session.baseUrl || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    window.kind !== 'material' || ![5, 10, 20, 50].includes(window.limit) || (window.apparatus_id && !isCanonicalApparatusId(window.apparatus_id))) throw new Error('Invalid supply task destination');
  url.protocol = 'wss:'; url.pathname = '/v1/mobile/production-tasks/live';
  url.search = new URLSearchParams({ kind: window.kind, apparatus: window.apparatus_id, limit: String(window.limit), search: window.search.trim().toLowerCase(),
    token, epoch: window.epoch, rev: String(window.revision), scope: window.scope }).toString();
  return url.toString();
}

export function subscribeMaterialTaskLive(session: Session, baseline: SupplyTaskWindow, current: () => boolean,
  handlers: { next(window: SupplyTaskWindow): void; error(error: unknown): void; done(): void }) {
  const url = materialTaskLiveUrl(session, baseline), native = productionLiveNativeModule();
  let stopped = false, window = baseline, id: string | null = null, subscription: { remove(): void } | undefined;
  let socket: WebSocket | undefined;
  const message = (data: unknown) => {
    if (stopped || !current()) return;
    try {
      const event = supplyTaskMessageFromJson(parseSupplyTaskJson(String(data)));
      const next = applySupplyTaskMessage(event, window);
      if (next.apparatus_id !== window.apparatus_id && event.type !== 'snapshot') throw new TypeError('Task stream changed query');
      window = next; handlers.next(next);
    } catch (error) { handlers.error(error); }
  };
  const stop = () => {
    if (stopped) return; stopped = true; subscription?.remove();
    if (id && native) native.stop(id); socket?.close();
  };
  try {
    if (native?.openSupplyTasks) {
      subscription = native.addListener('onProductionSocket', (event: NativeProductionSocketEvent) => {
        if (stopped || event.session !== id || !current()) return;
        if (event.type === 'message') message(event.value);
        else if (event.type === 'error') handlers.error(Object.assign(new Error('Vazifalar oqimi uzildi.'), { statusCode: event.statusCode }));
        else if (event.type === 'close') handlers.done();
      });
      id = native.openSupplyTasks(session.baseUrl, url);
    } else {
      // As in Worker, older installed binaries retain their real RN connection.
      // Rebuild to obtain the protocol ping/pong transport implemented above.
      socket = new WebSocket(url); socket.onmessage = event => message(event.data);
      socket.onerror = () => { if (!stopped && current()) handlers.error(new Error('Vazifalar oqimi uzildi.')); };
      socket.onclose = () => { if (!stopped && current()) handlers.done(); };
    }
  } catch (error) { stop(); throw error; }
  return stop;
}
