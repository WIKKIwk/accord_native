import { AppState, type AppStateStatus } from 'react-native';
import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';

/** Chat uses its own short-lived socket ticket, separate from the worker stream. */
export function subscribeChatLive(session: Session, onInvalidate: () => void, onEvent?: (event: Record<string, unknown>) => void): () => void {
  let stopped = false;
  let foreground = AppState.currentState == null || AppState.currentState === 'active';
  let generation = 0;
  let attempts = 0;
  let socket: WebSocket | null = null;
  let ticketRequest: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const invalidate = () => {
    if (notifyTimer !== undefined) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => { notifyTimer = undefined; if (!stopped && foreground) onInvalidate(); }, 100);
  };
  const clearSocketTimers = () => {
    if (readyTimer !== undefined) clearTimeout(readyTimer);
    if (heartbeat !== undefined) clearInterval(heartbeat);
    readyTimer = undefined;
    heartbeat = undefined;
  };
  const reconnect = () => {
    if (stopped || !foreground || retryTimer !== undefined || !activeSessionToken(session)) return;
    const delay = Math.min(15000, 1000 * 2 ** Math.min(attempts++, 4));
    retryTimer = setTimeout(() => { retryTimer = undefined; void connect(); }, delay);
  };
  const connect = async () => {
    if (stopped || !foreground || socket || ticketRequest || !activeSessionToken(session)) return;
    const current = generation;
    const controller = new AbortController();
    ticketRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await authorizedFetch(session, '/v1/mobile/chat/socket-ticket', { method: 'POST', signal: controller.signal });
      if (!response.ok) throw new Error('Chat aloqasi ochilmadi.');
      const payload = await response.json() as { ticket?: unknown };
      const ticket = typeof payload.ticket === 'string' ? payload.ticket.trim() : '';
      if (!ticket) throw new Error('Chat aloqasi ochilmadi.');
      if (stopped || !foreground || controller.signal.aborted || current !== generation || !activeSessionToken(session)) return;
      const url = new URL(session.baseUrl);
      if (url.protocol !== 'https:' || url.origin !== session.baseUrl) throw new Error('Server manzili noto‘g‘ri.');
      url.protocol = 'wss:';
      url.pathname = '/v1/mobile/chat/live';
      url.search = '';
      url.searchParams.set('ticket', ticket);
      const ws = new WebSocket(url.toString());
      socket = ws;
      readyTimer = setTimeout(() => { if (socket === ws) ws.close(); }, 10000);
      ws.onopen = () => {
        if (socket !== ws || stopped || !foreground) return;
        heartbeat = setInterval(() => {
          if (socket === ws && ws.readyState === WebSocket.OPEN) {
            try { ws.send('{"type":"ping"}'); } catch { ws.close(); }
          }
        }, 25000);
      };
      ws.onmessage = event => {
        if (socket !== ws || stopped || !foreground || !activeSessionToken(session)) return;
        let payload: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(String(event.data));
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { ws.close(); return; }
          payload = parsed as Record<string, unknown>;
        } catch { ws.close(); return; }
        if (payload.event === 'chat.ready') {
          if (readyTimer !== undefined) clearTimeout(readyTimer);
          readyTimer = undefined;
          attempts = 0;
          onEvent?.(payload);
          invalidate();
        } else if (payload.event === 'chat.resync_required' || payload.event === 'chat.message.created' || payload.event === 'chat.message.updated') {
          onEvent?.(payload);
          invalidate();
        }
      };
      ws.onerror = () => { if (socket === ws) ws.close(); };
      ws.onclose = () => {
        if (socket !== ws) return;
        socket = null;
        clearSocketTimers();
        reconnect();
      };
    } catch {
      if (!stopped && foreground && current === generation) reconnect();
    } finally {
      clearTimeout(timeout);
      if (ticketRequest === controller) ticketRequest = null;
    }
  };
  const pause = () => {
    generation++;
    ticketRequest?.abort();
    ticketRequest = null;
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    if (notifyTimer !== undefined) clearTimeout(notifyTimer);
    retryTimer = undefined;
    notifyTimer = undefined;
    clearSocketTimers();
    const old = socket;
    socket = null;
    old?.close();
  };
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    const next = state === 'active';
    if (next === foreground) return;
    foreground = next;
    if (!next) pause();
    else { attempts = 0; void connect(); }
  });
  void connect();
  return () => { stopped = true; pause(); subscription.remove(); };
}
