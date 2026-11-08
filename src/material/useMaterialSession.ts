import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { currentSession, isSessionWitnessCurrent, logout, registerSessionResetHook,
  sessionWitnessTransitioning, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { startMaterialSessionBootstrap, type MaterialSession } from './materialSessionBootstrap';
import { isMaterialTestSession } from './materialTestSession';

export function useMaterialSession() {
  const [entry, setEntry] = useState<MaterialSession | null | undefined>();
  const settled = useRef(false), mounted = useRef(false), retry = useRef<() => void>(() => {});
  // React subscribes and rechecks the version after subscription, closing the render/subscribe gap.
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  useEffect(() => {
    const bootstrap = startMaterialSessionBootstrap(value => { settled.current = true; setEntry(value); });
    retry.current = bootstrap.retry;
    return () => { retry.current = () => {}; bootstrap.stop(); };
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => registerSessionResetHook(async () => {
    if (settled.current) setEntry(null); else retry.current();
  }), []);
  // Never recapture a stale entry after a transition, including a transition that rolls back.
  const current = entry && isSessionWitnessCurrent(entry.witness) ? entry : null;
  const onLogout = () => {
    if (!current || isMaterialTestSession(current.session) || !isSessionWitnessCurrent(current.witness)) return;
    const owner = current.session;
    void logout(owner).catch(() => {}).finally(() => {
      const active = currentSession();
      if (mounted.current && !sessionWitnessTransitioning() && (active === owner || active === null)) setEntry(value => value?.session === owner ? null : value);
    });
  };
  return { session: entry === undefined ? undefined : current?.session ?? null, witness: current?.witness ?? null, onLogout };
}
