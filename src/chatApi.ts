import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isMyChatMessage, parseChatConversations, parseChatMessage, parseChatMessages } from './chatModel';

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

export async function loadChatMessages(session: Session, conversationId: string, signal?: AbortSignal, beforeSequence?: number) {
  const query = new URLSearchParams({ limit: '100' });
  if (beforeSequence && Number.isSafeInteger(beforeSequence) && beforeSequence > 0) query.set('before_sequence', String(beforeSequence));
  const response = await authorizedFetch(session, `${conversationPath(conversationId)}/messages?${query}`, { signal });
  if (!response.ok) throw new ChatRequestError('Xabarlarni yuklab bo‘lmadi.', response.status);
  const page = parseChatMessages(await response.json(), conversationId);
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
