import { useEffect } from 'react';
import { AppState } from 'react-native';
import { activeSessionToken, currentSession, registerSessionResetHook, sessionWitnessTransitioning, subscribeSessionWitness, type Session } from './auth';
import { workerQueueWarmStore } from './workerQueueWarmStore';
import { workerQueueCache } from './workerQueueCache';

let foreground = AppState.currentState == null || AppState.currentState === 'active';

/** @v2 _ProductionQueueWarmRuntimeState._synchronize */
function synchronize(): void {
  const session = currentSession();
  const worker = session && activeSessionToken(session) && session.token !== 'test-mode-token' &&
    (session.profile.role === 'aparatchi' || session.profile.role === 'rezka_master') &&
    (session.capabilities.includes('apparatus.queue.read') || session.capabilities.includes('rezka.master.access'));
  if (!worker) { workerQueueWarmStore.reset(); workerQueueCache.reset(); return; }
  // A same-account authentication transition does not change the read scope.
  if (sessionWitnessTransitioning()) { workerQueueWarmStore.pause(); return; }
  if (foreground) void workerQueueWarmStore.start(session);
  else workerQueueWarmStore.pause();
}

AppState.addEventListener('change', state => {
  if (state === 'active') { foreground = true; synchronize(); }
  // iOS inactive may be a system permission dialog, not a background visit.
  else if (state === 'background') { foreground = false; synchronize(); }
});
subscribeSessionWitness(synchronize);
registerSessionResetHook(async () => { workerQueueWarmStore.reset(); workerQueueCache.reset(); });

export function useWorkerQueueRuntime(session: Session | null): void {
  useEffect(() => { synchronize(); }, [session]);
}
