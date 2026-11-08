import { useCallback, useEffect, useRef, useState } from 'react';
import { activeSessionToken, isSessionWitnessCurrent, registerSessionResetHook, type Session, type SessionWitness } from '../auth';
import { profile } from '../profileApi';
import { isMaterialTestSession } from './materialTestSession';

/** V2 keeps the previous profile when pull-to-refresh fails. */
export function useMaterialScope(session: Session, witness: SessionWitness) {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(false), busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const unregister = registerSessionResetHook(async () => { mounted.current = false; });
    return () => { mounted.current = false; unregister(); };
  }, []);
  const refresh = useCallback(async () => {
    if (busy.current || isMaterialTestSession(session) || !activeSessionToken(session) || !isSessionWitnessCurrent(witness)) return;
    busy.current = true; setRefreshing(true);
    try { await profile(session); } catch { /* Keep the previous scope. */ }
    finally { busy.current = false; if (mounted.current && activeSessionToken(session) && isSessionWitnessCurrent(witness)) setRefreshing(false); }
  }, [session, witness]);
  return { groups: session.assigned_item_groups ?? [], refreshing, refresh };
}
