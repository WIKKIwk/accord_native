import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent, loadSession, logout, registerSessionResetHook,
  sessionWitnessVersion, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { clearAppLock } from '../appLock';

type MaterialSession = { session: Session; witness: SessionWitness };
export function useMaterialSession() {
  const [entry, setEntry] = useState<MaterialSession | null | undefined>();
  const generation = useRef(0);
  // React subscribes and rechecks the version after subscription, closing the render/subscribe gap.
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  useEffect(() => {
    let mounted = true; const request = generation.current;
    void loadSession().then(session => {
      if (!mounted || request !== generation.current) return;
      const witness = captureSessionWitness(session);
      setEntry(session && witness && isSessionWitnessCurrent(witness) ? { session, witness } : null);
    }).catch(() => { if (mounted && request === generation.current) setEntry(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => registerSessionResetHook(async () => { generation.current++; setEntry(null); }), []);
  // Never recapture a stale entry after a transition, including a transition that rolls back.
  const current = entry && isSessionWitnessCurrent(entry.witness) ? entry : null;
  const onLogout = () => {
    if (!current || !isSessionWitnessCurrent(current.witness)) return;
    void Promise.all([logout(current.session).catch(() => {}), clearAppLock(current.session).catch(() => {})]).finally(() => setEntry(null));
  };
  return { session: entry === undefined ? undefined : current?.session ?? null, witness: current?.witness ?? null, onLogout };
}
