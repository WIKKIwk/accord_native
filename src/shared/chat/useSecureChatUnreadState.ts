import { useEffect, useSyncExternalStore } from 'react';
import { activeSessionToken, type Session } from '../../auth';
import type { ChatLiveState } from '../../chatLive';
import { chatCacheScope } from './chatLocalStore';
import { chatUnreadRuntimeFor, existingChatUnreadRuntimeFor, subscribeChatUnreadRuntimeChanges } from './chatUnreadRuntime';
import { secureChatUnavailableReason } from './chatSecureReadiness';
import { subscribeSecureChatLive } from './secureChatLive';

type InternalStatus = { hasData: boolean; fetch: 'pending' | 'success' | 'failure'; live: ChatLiveState };
const initial: InternalStatus = { hasData: false, fetch: 'pending', live: 'connecting' };
const statuses = new WeakMap<Session, InternalStatus>();
const listeners = new Set<() => void>();
const subscribeStatus = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const statusFor = (session: Session) => statuses.get(session) ?? initial;
const update = (session: Session, patch: Partial<InternalStatus>) => {
  statuses.set(session, { ...statusFor(session), ...patch });
  for (const listener of listeners) listener();
};
const noRuntime = () => null;
const noSubscribe = () => () => {};
const zero = () => 0;

export type SecureChatUnreadState = { count: number | null; status: 'loading' | 'ready' | 'degraded' | 'unavailable'; message?: string };

/** New role shells use this rather than turning an unknown unread total into zero. */
export function useSecureChatUnreadState(session: Session): SecureChatUnreadState {
  let scope: string | null = null;
  try { scope = chatCacheScope(session); } catch { /* An incomplete session cannot start Chat. */ }
  const unavailable = secureChatUnavailableReason();
  const runtime = useSyncExternalStore(subscribeChatUnreadRuntimeChanges,
    () => existingChatUnreadRuntimeFor(session, 'secure'), noRuntime);
  const status = useSyncExternalStore(subscribeStatus, () => statusFor(session), () => initial);
  const count = useSyncExternalStore(runtime?.subscribe ?? noSubscribe, runtime?.getSnapshot ?? zero, zero);
  useEffect(() => {
    if (!scope || unavailable || !activeSessionToken(session)) return;
    if (!existingChatUnreadRuntimeFor(session, 'secure')) update(session, initial);
    const current = () => !!existingChatUnreadRuntimeFor(session, 'secure');
    try {
      const next = chatUnreadRuntimeFor(session, {
        policy: 'secure',
        subscribeLive: (onEvent, onInvalidate) => subscribeSecureChatLive(session, onInvalidate, onEvent,
          live => { if (current()) update(session, { live }); }),
        onConversationsLoaded: () => { if (current()) update(session, { hasData: true, fetch: 'success' }); },
        onConversationsFailed: () => { if (current()) update(session, { fetch: 'failure' }); },
      });
      void next.start().catch(() => { if (current()) update(session, { fetch: 'failure', live: 'unavailable' }); });
    } catch { update(session, { fetch: 'failure', live: 'unavailable' }); }
  }, [session, scope, unavailable]);
  if (unavailable) return { count: null, status: 'unavailable', message: unavailable };
  if (!scope || !activeSessionToken(session)) return { count: null, status: 'unavailable', message: 'Sessiya tugagan.' };
  if (!runtime || !status.hasData) return { count: null, status: status.fetch === 'failure' ? 'unavailable' : 'loading' };
  return { count, status: status.fetch === 'success' && status.live === 'ready' ? 'ready' : 'degraded' };
}
