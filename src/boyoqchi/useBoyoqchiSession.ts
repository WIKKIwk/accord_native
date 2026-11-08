import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isSessionWitnessCurrent, registerSessionResetHook, sessionWitnessVersion,
  subscribeSessionWitness, type SessionWitness } from '../auth';
import { startBoyoqchiSessionBootstrap } from './boyoqchiSessionBootstrap';

/** A new shell may wait for a transition; an invalidated settled shell never recaptures. */
export function useBoyoqchiSession() {
  const [witness, setWitness] = useState<SessionWitness | null | undefined>();
  const mounted = useRef(false);
  // React rechecks the version after subscribing, including a transition between render and subscription.
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  useEffect(() => {
    let settled = false;
    mounted.current = true;
    const bootstrap = startBoyoqchiSessionBootstrap(value => { settled = true; setWitness(value?.witness ?? null); });
    const unregister = registerSessionResetHook(async () => {
      if (settled) setWitness(null); else bootstrap.retry();
    });
    return () => { mounted.current = false; unregister(); bootstrap.stop(); };
  }, []);
  return { witness: witness && !isSessionWitnessCurrent(witness) ? null : witness, mounted };
}
