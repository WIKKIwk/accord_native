import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { parseOpenedChatConversation, type ChatPeer } from '../chatModel';
import { MobileApiException } from '../shared/mobileApiException';
import { checkedAdminGuard } from './adminProductionRequest';
import { AdminProfileChatTransportFailure } from './adminProfileChatModel';
import { dartJsonString } from './dartJsonString';

/** @v2 chatCreateDm
 * Only the direct request boundary. ChatStore start/upsert/local persistence and the real
 * thread destination must be composed separately before a profile action can be exposed. */
export async function openAdminProfileChatConversation(session: Session, target: ChatPeer, guard: () => void) {
  const check = checkedAdminGuard(guard); if (!check) throw new TypeError('Admin profile chat requires its original guard');
  check(); const original = Object.freeze({ ...target }); check();
  let response: Response;
  try {
    response = await authorizedFetch(session, '/v1/mobile/chat/conversations/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: original.role, ref: original.ref }) }, check); check();
  } catch (error) {
    check();
    if (error instanceof TypeError) throw new AdminProfileChatTransportFailure('network');
    if (error instanceof Error && error.name === 'TimeoutError') throw new AdminProfileChatTransportFailure('timeout');
    throw error;
  }
  if (response.status < 200 || response.status >= 300) {
    let code = 'chat_create_failed';
    try { const value: unknown = await response.json(); check();
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const error = (value as Record<string, unknown>).error; if (error != null) code = dartJsonString(error);
      }
    } catch { check(); }
    check(); throw new MobileApiException({ code, message: 'Chat so‘rovi bajarilmadi', statusCode: response.status });
  }
  let value: unknown;
  try { value = await response.json(); } catch (error) { check(); throw error; }
  check();
  try { return parseOpenedChatConversation(value, original); } finally { check(); }
}
