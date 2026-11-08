import { activeSessionToken, registerSessionResetHook, type Session } from '../../auth';
import { subscribeChatLive, type ChatLiveState } from '../../chatLive';
import { SECURE_CHAT_UNAVAILABLE, secureChatAvailable, secureChatSocket } from './chatSecureSocket';

/** Explicit opt-in for new roles. No legacy socket is used if native support is missing. */
export function subscribeSecureChatLive(session: Session, onInvalidate: () => void,
  onEvent?: (event: Record<string, unknown>) => void, onStateChange?: (state: ChatLiveState) => void): () => void {
  if (!activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  if (!secureChatAvailable()) throw new Error(SECURE_CHAT_UNAVAILABLE);
  let stopLive: (() => void) | undefined;
  let stopped = false;
  const unregister = registerSessionResetHook(async () => stop());
  const stop = () => {
    if (stopped) return;
    stopped = true;
    unregister();
    stopLive?.();
  };
  try {
    stopLive = subscribeChatLive(session, onInvalidate, onEvent, {
      socketFactory: url => secureChatSocket(session, url), onStateChange,
    });
  } catch (error) { stop(); throw error; }
  return stop;
}
