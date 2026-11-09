import { chatSecureNativeModule, type NativeChatSocketEvent } from '../../../modules/accord-chat-secure/src/AccordChatSecureModule';
import { activeSessionToken, registerSessionResetHook, type Session } from '../../auth';
import type { ChatLiveSocket } from '../../chatLive';

export const SECURE_CHAT_UNAVAILABLE = 'Chat so‘rovi bajarilmadi';

export function secureChatAvailable(): boolean {
  try { return chatSecureNativeModule() != null; } catch { return false; }
}

/** Reject arbitrary URLs before a ticket can cross the native bridge. */
export function secureChatDestination(session: Session, rawUrl: string): { origin: string; ticket: string } {
  if (!activeSessionToken(session)) throw new Error('No session token');
  let base: URL, target: URL;
  try { base = new URL(session.baseUrl); target = new URL(rawUrl); }
  catch { throw new Error('Server manzili noto‘g‘ri.'); }
  const expected = `wss://${base.host}`;
  let parameters = 0;
  target.searchParams.forEach(() => { parameters++; });
  const ticket = target.searchParams.get('ticket');
  if (base.protocol !== 'https:' || base.origin !== session.baseUrl || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash || target.origin !== expected || target.username || target.password ||
      target.pathname !== '/v1/mobile/chat/live' || target.hash || parameters !== 1 || !ticket || ticket !== ticket.trim()) {
    throw new Error('Server manzili noto‘g‘ri.');
  }
  return { origin: session.baseUrl, ticket };
}

/** WebSocket-shaped facade; it never falls back to the React Native WebSocket. */
export function secureChatSocket(session: Session, rawUrl: string): ChatLiveSocket {
  const { origin, ticket } = secureChatDestination(session, rawUrl);
  const native = chatSecureNativeModule();
  if (!native) throw new Error(SECURE_CHAT_UNAVAILABLE);
  let id: string | null = null;
  const role = session.profile.role, ref = session.profile.ref;
  let readyState = 0;
  let closed = false;
  let unregister = () => {};
  let subscription: { remove(): void } | null = null;
  const current = () => !!activeSessionToken(session) && session.baseUrl === origin &&
    session.profile.role === role && session.profile.ref === ref;
  const socket: ChatLiveSocket = {
    get readyState() { return readyState; },
    onopen: null, onmessage: null, onerror: null, onclose: null,
    send(value) {
      let sent = false;
      if (!closed && id && readyState === 1 && current() && typeof value === 'string') {
        try { sent = native.send(id, value); } catch { /* Closing below also handles a destroyed native module. */ }
      }
      if (!sent) {
        socket.close();
        throw new Error('Chat aloqasi ochilmadi.');
      }
    },
    close() {
      if (closed) return;
      closed = true;
      readyState = 3;
      subscription?.remove();
      unregister();
      try { if (id) native.stop(id); } catch { /* A destroyed native module is already stopped. */ }
      void Promise.resolve().then(() => socket.onclose?.({} as CloseEvent));
    },
  };
  const onEvent = (event: NativeChatSocketEvent) => {
    if (closed || event.session !== id) return;
    if (!current()) { socket.close(); return; }
    switch (event.type) {
      case 'open': readyState = 1; socket.onopen?.({} as Event); break;
      case 'message': if (readyState === 1) socket.onmessage?.({ data: event.value } as MessageEvent); break;
      case 'error': socket.onerror?.({} as Event); break;
      case 'close': socket.close(); break;
    }
  };
  try {
    subscription = native.addListener('onChatSocket', onEvent);
    unregister = registerSessionResetHook(async () => { socket.close(); });
    id = native.open(origin, ticket);
  } catch {
    closed = true;
    subscription?.remove();
    unregister();
    try { if (id) native.stop(id); } catch { /* Opening failed before a native socket existed. */ }
    throw new Error('Chat aloqasi ochilmadi.');
  }
  return socket;
}
