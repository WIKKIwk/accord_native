import { AppState, type AppStateStatus } from 'react-native';
import { activeSessionToken, registerSessionResetHook, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { secureChatSocket } from './shared/chat/chatSecureSocket';

/** Chat uses its own short-lived socket ticket, separate from the worker stream. */
export type ChatLiveState = 'connecting' | 'ready' | 'unavailable' | 'paused';
export type ChatLiveSocket = { readonly readyState: number; onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null; send: (data: string) => void; close: () => void };
type ChatLiveOptions = { socketFactory?: (url: string) => ChatLiveSocket; onStateChange?: (state: ChatLiveState) => void };

/** @v2 ChatRealtimeService */
export function subscribeChatLive(session: Session, onInvalidate: () => void, onEvent?: (event: Record<string, unknown>) => void,
  options?: ChatLiveOptions): () => void {
  let stopped = false;
  let foreground = AppState.currentState == null || AppState.currentState === 'active';
  let generation = 0;
  let attempts = 0;
  let socket: ChatLiveSocket | null = null;
  let ticketRequest: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;
  const state = (value: ChatLiveState) => { try { options?.onStateChange?.(value); } catch { /* Observers cannot interrupt cleanup. */ } };

  const invalidate = () => {
    if (notifyTimer !== undefined) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => { notifyTimer = undefined; if (!stopped && foreground && activeSessionToken(session)) onInvalidate(); }, 100);
  };
  const clearSocketTimers = () => {
    if (connectTimer !== undefined) clearTimeout(connectTimer);
    connectTimer = undefined;
  };
  const reconnect = () => {
    if (stopped || !foreground || retryTimer !== undefined || !activeSessionToken(session)) return;
    const delay = Math.min(15000, 1000 * 2 ** Math.min(attempts++, 4));
    retryTimer = setTimeout(() => { retryTimer = undefined; void connect(); }, delay);
  };
  const connect = async () => {
    if (stopped || !foreground || socket || ticketRequest || !activeSessionToken(session)) return;
    state('connecting');
    const current = generation;
    const controller = new AbortController();
    ticketRequest = controller;
    try {
      // @v2 chatLiveUri: authorizedFetch owns the 10-second deadline of each
      // POST attempt, including the single retry after shared reauthentication.
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
      const ws = options?.socketFactory ? options.socketFactory(url.toString()) : secureChatSocket(session, url.toString());
      socket = ws;
      // @v2 connectWarehouseLivePlatform: time out the handshake, not a quiet
      // established connection. Protocol ping/pong is owned by the native socket.
      connectTimer = setTimeout(() => { if (socket === ws) ws.close(); }, 10000);
      ws.onopen = () => {
        if (socket !== ws || stopped || !foreground) return;
        clearSocketTimers();
      };
      ws.onmessage = event => {
        if (socket !== ws || stopped || !foreground || !activeSessionToken(session)) return;
        if (typeof event.data !== 'string') return;
        let payload: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { ws.close(); return; }
          payload = parsed as Record<string, unknown>;
        } catch { ws.close(); return; }
        // V2 marks the connection up and resets backoff for every decoded map.
        attempts = 0;
        state('ready');
        onEvent?.(payload);
        if (payload.event === 'chat.ready' || payload.event === 'chat.resync_required' ||
            payload.event === 'chat.message.created' || payload.event === 'chat.message.updated') {
          invalidate();
        }
      };
      ws.onerror = () => { if (socket === ws) { state('unavailable'); ws.close(); } };
      ws.onclose = () => {
        if (socket !== ws) return;
        socket = null;
        clearSocketTimers();
        state('unavailable');
        reconnect();
      };
    } catch {
      if (!stopped && foreground && current === generation) { state('unavailable'); reconnect(); }
    } finally {
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
    state('paused');
  };
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    const next = state === 'active';
    if (next === foreground) return;
    foreground = next;
    if (!next) pause();
    else { attempts = 0; void connect(); }
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    pause();
    subscription.remove();
    unregister();
  };
  const unregister = registerSessionResetHook(async () => stop());
  void connect();
  return stop;
}
