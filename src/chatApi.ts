import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { parseChatConversations } from './chatModel';

export async function loadChatConversations(session: Session, signal?: AbortSignal) {
  const response = await authorizedFetch(session, '/v1/mobile/chat/conversations?limit=100', { signal });
  if (!response.ok) throw new Error(response.status === 403 ? 'Bu hisob uchun chat ochilmagan.' : 'Chatlarni yuklab bo‘lmadi.');
  const page = parseChatConversations(await response.json());
  if (signal?.aborted || !activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  return page;
}
