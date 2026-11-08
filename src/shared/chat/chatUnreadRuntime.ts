import { AppState } from 'react-native';
import { activeSessionToken, registerSessionResetHook, type Session } from '../../auth';
import { loadChatConversations, loadChatMessagesAfter, loadChatSync, markChatDelivered, markChatRead } from '../../chatApi';
import { subscribeChatLive } from '../../chatLive';
import { parseChatMessage } from '../../chatModel';
import { chatDeviceId } from '../../chatOutbox';
import {
  acknowledgePendingChatReceipt, chatCacheScope, latestCachedChatMessageSequence, loadCachedChatConversations,
  loadCachedChatSyncCursor, loadPendingChatReceipts, saveCachedChatConversations, saveCachedChatMessages,
  saveCachedChatSyncCursor, savePendingChatReceipt,
} from './chatLocalStore';
import { ChatSessionRuntime } from './chatSessionRuntime';
import type { ChatLivePolicy } from './ChatLivePolicy';
import { secureChatUnavailableReason } from './chatSecureReadiness';

export type ChatUnreadTransport = { policy: 'secure';
  subscribeLive: (onEvent: (payload: Record<string, unknown>) => void, onInvalidate: () => void) => () => void;
  onConversationsLoaded: () => void; onConversationsFailed: () => void };
type CurrentRuntime = { session: Session; scope: string; policy: ChatLivePolicy; runtime: ChatSessionRuntime; unregister: () => void; removeAppState: () => void };
let current: CurrentRuntime | null = null;
const runtimeListeners = new Set<() => void>();

export function subscribeChatUnreadRuntimeChanges(listener: () => void): () => void {
  runtimeListeners.add(listener);
  return () => { runtimeListeners.delete(listener); };
}

function notifyRuntimeChange(): void { for (const listener of runtimeListeners) listener(); }

function disposeCurrent(): void {
  const old = current;
  current = null;
  if (!old) return;
  old.unregister();
  old.removeAppState();
  old.runtime.close();
  notifyRuntimeChange();
}

/** Reuses one runtime per active login; logout or account change closes it. */
export function chatUnreadRuntimeFor(session: Session, transport?: ChatUnreadTransport): ChatSessionRuntime {
  const scope = chatCacheScope(session);
  const policy = transport?.policy ?? 'legacy';
  if (!activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  if (transport) {
    const unavailable = secureChatUnavailableReason();
    if (unavailable) throw new Error(unavailable);
  }
  if (current?.session === session && current.scope === scope && current.policy === policy) return current.runtime;
  disposeCurrent();
  const controller = new AbortController();
  let runtime!: ChatSessionRuntime;
  const isCurrent = () => {
    try { return current?.runtime === runtime && !!activeSessionToken(session) && chatCacheScope(session) === scope; }
    catch { return false; }
  };
  runtime = new ChatSessionRuntime({ role: String(session.profile.role ?? '').trim(), ref: String(session.profile.ref ?? '').trim() }, {
    isCurrent,
    loadConversations: () => loadCachedChatConversations(session),
    saveConversations: items => saveCachedChatConversations(session, items),
    fetchConversations: () => loadChatConversations(session, controller.signal),
    onConversationsLoaded: transport?.onConversationsLoaded,
    onConversationsFailed: transport?.onConversationsFailed,
    loadCursor: () => loadCachedChatSyncCursor(session),
    saveCursor: cursor => saveCachedChatSyncCursor(session, cursor),
    loadSync: cursor => loadChatSync(session, cursor, controller.signal),
    loadAfter: (id, sequence) => loadChatMessagesAfter(session, id, sequence, controller.signal),
    latestSavedSequence: id => latestCachedChatMessageSequence(session, id),
    saveMessages: items => saveCachedChatMessages(session, items),
    loadReceipts: () => loadPendingChatReceipts(session),
    saveReceipt: receipt => savePendingChatReceipt(session, receipt),
    acknowledgeReceipt: (id, delivered, read) => acknowledgePendingChatReceipt(session, id, delivered, read),
    deviceId: chatDeviceId,
    sendDelivered: (id, sequence, deviceId) => markChatDelivered(session, id, sequence, deviceId, controller.signal),
    sendRead: (id, sequence, deviceId) => markChatRead(session, id, sequence, deviceId, controller.signal),
    decodeRealtimeMessage: payload => {
      const raw = payload.message;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const conversationId = (raw as Record<string, unknown>).conversation_id;
      return parseChatMessage(raw, typeof conversationId === 'string' ? conversationId.trim() : '');
    },
    subscribeLive: (onEvent, onInvalidate) => transport
      ? transport.subscribeLive(onEvent, onInvalidate) : subscribeChatLive(session, onInvalidate, onEvent),
    scheduleRecovery: callback => {
      const timer = setInterval(callback, 30000);
      return () => clearInterval(timer);
    },
    abort: () => controller.abort(),
  }, AppState.currentState == null || AppState.currentState === 'active');
  const listener = AppState.addEventListener('change', state => {
    if (state === 'active') runtime.resume();
    else if (state === 'background') runtime.pause();
  });
  const unregister = registerSessionResetHook(async () => { if (current?.runtime === runtime) disposeCurrent(); });
  current = { session, scope, policy, runtime, unregister, removeAppState: () => listener.remove() };
  notifyRuntimeChange();
  return runtime;
}

/** Does not start a service for roles that are not using the shared badge. */
export function existingChatUnreadRuntimeFor(session: Session, policy: ChatLivePolicy = 'legacy'): ChatSessionRuntime | null {
  try {
    return current?.session === session && current.scope === chatCacheScope(session) && current.policy === policy && activeSessionToken(session)
      ? current.runtime : null;
  } catch { return null; }
}
