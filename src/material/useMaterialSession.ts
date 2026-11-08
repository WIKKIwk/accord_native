import { useEffect, useRef, useState } from 'react';
import { loadSession, logout, registerSessionResetHook, type Session } from '../auth';
import { clearAppLock } from '../appLock';

export function useMaterialSession() {
  const [session, setSession] = useState<Session | null | undefined>();
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true; const request = generation.current;
    void loadSession().then(value => { if (mounted && request === generation.current) setSession(value); })
      .catch(() => { if (mounted && request === generation.current) setSession(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => registerSessionResetHook(async () => { generation.current++; setSession(null); }), []);
  const onLogout = () => {
    if (!session) return;
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => setSession(null));
  };
  return { session, onLogout };
}
