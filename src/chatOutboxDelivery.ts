import { activeSessionToken, type Session } from './auth';
import { sendChatText } from './chatApi';
import type { ChatMessage } from './chatModel';
import { pendingChatTexts, removePendingChatText, type PendingChatText } from './chatOutbox';

const SEND_TIMEOUT_MS = 15_000;

/** Keep the original client id until the server confirms that exact message. */
export async function flushChatOutbox(
  session: Session, conversationId: string, signal: AbortSignal,
  onConfirmed: (message: ChatMessage, pending: PendingChatText) => void,
): Promise<void> {
  while (!signal.aborted && activeSessionToken(session)) {
    const item = (await pendingChatTexts(session, conversationId))[0];
    if (!item || signal.aborted || !activeSessionToken(session)) return;
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, SEND_TIMEOUT_MS);
    try {
      const message = await sendChatText(session, conversationId, item.clientMessageId, item.body, request.signal);
      await removePendingChatText(session, item.clientMessageId);
      onConfirmed(message, item);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
}
