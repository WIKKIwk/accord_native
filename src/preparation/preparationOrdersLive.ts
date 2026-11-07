import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { WorkerControlException } from '../workerControlsApi';
import type { PreparationOrderListWindow } from './preparationOrdersApi';

/** @v2 preparationOrdersLive */
export function subscribePreparationOrdersLive(session: Session, window: PreparationOrderListWindow,
  options: { search?: string; length?: number; allApparatus?: boolean }, onMessage: (event: Record<string, unknown>) => void,
  onError: (error: unknown) => void, onDone: () => void): () => void {
  const token = activeSessionToken(session), scope = sessionReadScope(session), baseUrl = session.baseUrl;
  const current = () => !!token && activeSessionToken(session) === token && sessionReadScope(session) === scope && session.baseUrl === baseUrl;
  let closed = false, socket: WebSocket | null = null, timer: ReturnType<typeof setTimeout> | null = null;
  const finish = (error?: unknown) => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    socket?.close(); socket = null;
    if (error !== undefined) onError(error);
    onDone();
  };
  if (!current()) { finish(new WorkerControlException('session_changed', 'Ulanish hisob doirasi o‘zgardi.')); return () => {}; }
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/mobile/preparation/orders/live';
  url.search = new URLSearchParams({ token: token!, apparatus: window.apparatus_id, ...(options.allApparatus ? { all_apparatus: 'true' } : {}), search: options.search ?? '', limit: '30',
    epoch: window.epoch, rev: String(window.rev), scope: window.scope, version: window.version,
    length: String(options.length ?? window.rows.length) }).toString();
  try {
    const ws = new WebSocket(url.toString()); socket = ws;
    timer = setTimeout(() => finish(new Error('WebSocket connection timed out')), 10000);
    ws.onopen = () => { if (timer) clearTimeout(timer); timer = null; };
    ws.onmessage = message => {
      if (closed || socket !== ws || typeof message.data !== 'string') return;
      if (!current()) { finish(new WorkerControlException('session_changed', 'Ulanish hisob doirasi o‘zgardi.')); return; }
      try {
        const value: unknown = JSON.parse(message.data);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid live event');
        if (options.allApparatus && ['list_snapshot', 'list_delta'].includes(String((value as Record<string, unknown>).type)) &&
            (value as Record<string, unknown>).all_apparatus !== true) throw new Error('Barcha buyurtmalar doirasi o‘zgardi.');
        onMessage(value as Record<string, unknown>);
      } catch (error) { finish(error); }
    };
    ws.onerror = event => finish(event);
    ws.onclose = () => finish();
  } catch (error) { finish(error); }
  return () => { if (closed) return; closed = true; if (timer) clearTimeout(timer); socket?.close(); socket = null; };
}
