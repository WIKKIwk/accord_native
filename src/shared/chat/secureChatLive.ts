import { activeSessionToken, registerSessionResetHook, type Session } from '../../auth';
import { subscribeChatLive, type ChatLiveState } from '../../chatLive';
import { secureChatSocket } from './chatSecureSocket';
import { secureChatUnavailableReason } from './chatSecureReadiness';

/** Explicit opt-in for new roles. No legacy socket is used if native support is missing. */
export function subscribeSecureChatLive(session: Session, onInvalidate: () => void,
  onEvent?: (event: Record<string, unknown>) => void, onStateChange?: (state: ChatLiveState) => void): () => void {
  if (!activeSessionToken(session)) throw new Error('Sessiya tugagan.');
  const unavailable = secureChatUnavailableReason();
  if (unavailable) throw new Error(unavailable);
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
