import { useEffect, useSyncExternalStore } from 'react';
import type { Session } from '../../auth';
import { chatCacheScope } from './chatLocalStore';
import { chatUnreadRuntimeFor, existingChatUnreadRuntimeFor, subscribeChatUnreadRuntimeChanges } from './chatUnreadRuntime';

const noSubscribe = () => () => {};
const zero = () => 0;
const noRuntime = () => null;

/** A role dock can use the same session-wide unread total as V2 ChatStore. */
export function useChatUnreadCount(session: Session): number {
  let scope: string | null = null;
  try { scope = chatCacheScope(session); } catch { /* An incomplete session cannot start Chat. */ }
  const runtime = useSyncExternalStore(subscribeChatUnreadRuntimeChanges, () => existingChatUnreadRuntimeFor(session), noRuntime);
  useEffect(() => {
    if (!scope) return;
    try {
      const next = chatUnreadRuntimeFor(session);
      void next.start().catch(() => {});
    } catch { /* A session that has ended cannot start Chat. */ }
  }, [session, scope]);
  return useSyncExternalStore(runtime?.subscribe ?? noSubscribe, runtime?.getSnapshot ?? zero, zero);
}
