import { useCallback, useEffect, useRef, useState } from 'react';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { profile } from '../profileApi';

/** V2 keeps the previous profile when pull-to-refresh fails. */
export function useMaterialScope(session: Session) {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false), busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const unregister = registerSessionResetHook(async () => { mounted.current = false; });
    return () => { mounted.current = false; unregister(); };
  }, []);
  const refresh = useCallback(async () => {
    if (busy.current || !activeSessionToken(session)) return;
    busy.current = true; setRefreshing(true);
    try { await profile(session); } catch { /* Keep the previous scope. */ }
    finally { busy.current = false; if (mounted.current && activeSessionToken(session)) setRefreshing(false); }
  }, [session]);
  return { groups: session.assigned_item_groups ?? [], refreshing, refresh };
}
