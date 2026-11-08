import { useEffect, useState } from 'react';
import { activeSessionToken, loadSession, registerSessionResetHook, type Session } from '../auth';
import { adminShellMayEnter } from './adminShellAccess';

/** A stale load or a reset cannot install an old session into a newly mounted role shell. */
export function useAdminShellSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    let mounted = true, generation = 0;
    const unregister = registerSessionResetHook(async () => { generation++; if (mounted) setSession(null); });
    const started = generation;
    void loadSession().then(value => {
      if (mounted && generation === started) setSession(value && activeSessionToken(value) && adminShellMayEnter(value) ? value : null);
    }).catch(() => { if (mounted && generation === started) setSession(null); });
    return () => { mounted = false; generation++; unregister(); };
  }, []);
  return session;
}
