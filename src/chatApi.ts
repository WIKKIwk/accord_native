import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isMyChatMessage, parseChatConversations, parseChatDirectory, parseChatMessage, parseChatMessages, parseChatMessagesForRecovery, parseChatSyncPage, parseOpenedChatConversation, type ChatPeer } from './chatModel';

export class ChatRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function conversationPath(conversationId: string): string {
  const id = conversationId.trim();
  if (!id || id === '.' || id === '..') throw new Error('Suhbat topilmadi.');
  return `/v1/mobile/chat/conversations/${encodeURIComponent(id)}`;
}

export async function loadChatConversations(session: Session, signal?: AbortSignal) {
  const response = await authorizedFetch(session, '/v1/mobile/chat/conversations?limit=100', { signal });
  if (!response.ok) throw new Error(response.status === 403 ? 'Bu hisob uchun chat ochilmagan.' : 'Chatlarni yuklab bo‘lmadi.');
  const page = parseChatConversations(await response.json());
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return page;
}

export async function loadChatDirectory(session: Session, query: string, offset = 0, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: '100' });
  if (query.trim()) params.set('q', query.trim());
  if (Number.isSafeInteger(offset) && offset > 0) params.set('offset', String(offset));
  const response = await authorizedFetch(session, `/v1/mobile/chat/directory?${params}`, { signal });
  if (!response.ok) throw new ChatRequestError(response.status === 403 ? 'Bu hisob uchun chat ochilmagan.' : 'Foydalanuvchilarni yuklab bo‘lmadi.', response.status);
  const page = parseChatDirectory(await response.json());
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return page;
}

export async function openChatConversation(session: Session, target: ChatPeer, signal?: AbortSignal) {
  if (!target.role.trim() || !target.ref.trim()) throw new Error('Foydalanuvchi topilmadi.');
  const response = await authorizedFetch(session, '/v1/mobile/chat/conversations/dm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: target.role, ref: target.ref }), signal,
  });
  if (!response.ok) throw new ChatRequestError(response.status === 403 ? 'Bu hisob uchun chat ochilmagan.' : 'Suhbatni ochib bo‘lmadi.', response.status);
  const conversation = parseOpenedChatConversation(await response.json(), target);
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return conversation;
}

export async function loadChatMessages(session: Session, conversationId: string, signal?: AbortSignal, beforeSequence?: number) {
  const query = new URLSearchParams({ limit: '100' });
  if (beforeSequence && Number.isSafeInteger(beforeSequence) && beforeSequence > 0) query.set('before_sequence', String(beforeSequence));
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/messages?${query}`, { signal });
  if (!response.ok) throw new ChatRequestError('Xabarlarni yuklab bo‘lmadi.', response.status);
  const page = parseChatMessages(await response.json(), conversationId);
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return page;
}

/** @v2 chatMessages */
export async function loadChatMessagesAfter(session: Session, conversationId: string, afterSequence: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: '100', after_sequence: String(afterSequence) });
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/messages?${query}`, { signal });
  if (!response.ok) throw new ChatRequestError('Chat so‘rovi bajarilmadi', response.status);
  const page = parseChatMessagesForRecovery(await response.json(), conversationId);
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return page;
}

/** @v2 chatSync */
export async function loadChatSync(session: Session, cursor: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ cursor: String(cursor), limit: '200' });
  const response = await authorizedFetch(session, `/v1/mobile/chat/sync?${query}`, { signal });
  if (!response.ok) throw new ChatRequestError('Chat so‘rovi bajarilmadi', response.status);
  const page = parseChatSyncPage(await response.json());
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return page;
}

export async function sendChatText(session: Session, conversationId: string, clientMessageId: string, body: string, signal?: AbortSignal) {
  const message = body.trim();
  if (!message || Array.from(message).length > 4000 || !clientMessageId.trim()) throw new Error('Xabar matni noto‘g‘ri.');
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_message_id: clientMessageId, body: message }), signal,
  });
  if (!response.ok) throw new ChatRequestError('Xabar yuborilmadi.', response.status);
  const payload: unknown = await response.json();
  const raw = payload && typeof payload === 'object' ? (payload as { message?: unknown }).message : null;
  const confirmed = parseChatMessage(raw, conversationId);
  const source = raw && typeof raw === 'object' ? raw as { type?: unknown; attachment?: unknown } : null;
  if (signal?.aborted || !activeSessionToken(session) || !confirmed || confirmed.clientMessageId !== clientMessageId ||
    !isMyChatMessage(session, confirmed) || source?.type !== 'text' || source.attachment != null || confirmed.body !== message) {
    throw new Error('Xabar tasdiqlanmadi.');
  }
  return confirmed;
}

export async function markChatRead(session: Session, conversationId: string, sequence: number, deviceId: string, signal?: AbortSignal) {
  if (!Number.isSafeInteger(sequence) || sequence <= 0 || !deviceId.trim()) return;
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/read`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence, device_id: deviceId }), signal,
  });
  if (!response.ok) throw new ChatRequestError('O‘qilgan holat saqlanmadi.', response.status);
}

/** @v2 chatMarkDelivered */
export async function markChatDelivered(session: Session, conversationId: string, sequence: number, deviceId: string, signal?: AbortSignal) {
  if (!Number.isSafeInteger(sequence) || sequence <= 0 || !deviceId.trim()) return;
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/delivered`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence, device_id: deviceId }), signal,
  });
  if (!response.ok) throw new ChatRequestError('Chat so‘rovi bajarilmadi', response.status);
}
