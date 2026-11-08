import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSessionResetHook, type Session, type SessionWitness } from '../auth';
import { profile } from '../profileApi';
import { materialProfileCurrent } from './materialProfileGuard';

/** V2 keeps the previous profile when pull-to-refresh fails. */
export function useMaterialScope(session: Session, witness: SessionWitness) {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false), busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const unregister = registerSessionResetHook(async () => { mounted.current = false; });
    return () => { mounted.current = false; unregister(); };
  }, []);
  const current = useCallback(() => materialProfileCurrent(session, witness), [session, witness]);
  const refresh = useCallback(async () => {
    if (busy.current || !current()) return;
    busy.current = true; setRefreshing(true);
    try { await profile(session, false, current); } catch { /* Keep the previous scope. */ }
    finally { busy.current = false; if (mounted.current && current()) setRefreshing(false); }
  }, [session, current]);
  return { groups: session.assigned_item_groups ?? [], refreshing, refresh };
}
