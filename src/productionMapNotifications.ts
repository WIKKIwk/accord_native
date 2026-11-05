import { activeSessionToken, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { WorkerControlException } from './workerControlsApi';
import { completionRequestNotification } from './workerQueueModels';
import { adminProductionMapLiveUri } from './workerLiveUri';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';

type Obj = Record<string, unknown>;
type Listener = { next: (value: Obj[]) => void; error: (error: unknown) => void; done?: () => void };
type Feed = { subscribe: (next: Listener['next'], error: Listener['error'], done?: Listener['done']) => () => void };
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const feeds = new Map<string, Feed>();

export function decodeProductionMapNotifications(value: unknown, session?: Session): Obj[] {
  const event = object(value);
  if (!event) throw new TypeError('Invalid notification event');
  if (event.ok !== true) throw new WorkerControlException(event.error == null ? 'production_map_live_failed' : String(event.error),
    'Bildirishnomalar ulanishi uzildi.');
  if (event.type !== 'notifications_snapshot' && Array.isArray(event.maps) && Array.isArray(event.completion_requests)) {
    return decodeCanonicalProductionMapSnapshot(event, true, session).completion_requests;
  }
  if (event.type !== 'notifications_snapshot' || !Array.isArray(event.completion_requests) || !Number.isInteger(event.rev) ||
      typeof event.epoch !== 'string' || !event.epoch) {
    throw new WorkerControlException('production_map_snapshot_contract_invalid', 'Production map navbati server shartnomasiga mos emas: invalid notification event');
  }
  return event.completion_requests.map(completionRequestNotification);
}

// The canonical decoder remains under parity review, so this method is not tagged complete.
export function adminProductionMapNotificationEvents(session: Session): Feed {
  const token = activeSessionToken(session), baseUrl = session.baseUrl, scope = sessionReadScope(session);
  const key = JSON.stringify([baseUrl, token, scope]);
  const current = () => !!token && activeSessionToken(session) === token && session.baseUrl === baseUrl && sessionReadScope(session) === scope;
  const existing = feeds.get(key);
  if (existing) return existing;
  const listeners = new Set<Listener>();
  let socket: WebSocket | null = null, latest: Obj[] | null = null, connecting = false, generation = 0;
  const remove = () => { if (feeds.get(key) === feed) feeds.delete(key); };
  const stop = () => { generation++; connecting = false; const previous = socket; socket = null; previous?.close(); };
  const finish = (error?: unknown) => {
    remove(); latest = null; stop();
    const pending = [...listeners]; listeners.clear();
    for (const listener of pending) { if (error !== undefined) listener.error(error); listener.done?.(); }
  };
  const stale = () => finish(new WorkerControlException('session_changed', 'Bildirishnomalar hisob doirasi o‘zgardi.'));
  const start = () => {
    if (socket || connecting) return;
    connecting = true;
    const activeGeneration = ++generation;
    queueMicrotask(() => {
      if (generation !== activeGeneration || !listeners.size) return;
      connecting = false;
      if (!current()) { stale(); return; }
      let ws: WebSocket;
      try { ws = new WebSocket(adminProductionMapLiveUri(baseUrl, token!, { notificationsOnly: true }).toString()); }
      catch (error) { finish(error); return; }
      socket = ws;
      ws.onmessage = message => {
        if (generation !== activeGeneration || socket !== ws) return;
        if (!current()) { stale(); return; }
        let notifications: Obj[];
        try { notifications = decodeProductionMapNotifications(JSON.parse(String(message.data)), session); }
        catch (error) { finish(error); return; }
        latest = notifications;
        for (const listener of [...listeners]) listener.next(notifications);
      };
      ws.onerror = () => { if (generation === activeGeneration) finish(new Error('Notification connection failed')); };
      ws.onclose = () => { if (generation === activeGeneration) finish(); };
    });
  };
  const feed: Feed = {
    subscribe(next, error, done) {
      const listener: Listener = { next, error, done };
      listeners.add(listener);
      if (!current()) { stale(); return () => {}; }
      if (latest) next(latest);
      start();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { latest = null; remove(); stop(); }
      };
    },
  };
  feeds.set(key, feed);
  return feed;
}
