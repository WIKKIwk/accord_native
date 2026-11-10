import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { workerPaddonOwner } from '../workerPaddonRuntime';
import type { WorkerPaddonState } from '../workerPaddonModel';

export function useWorkerPaddonOwner(session: Session, apparatus: string) {
  const scope = sessionReadScope(session);
  const owner = useMemo(() => workerPaddonOwner(session, apparatus, scope), [session, apparatus, scope]);
  useLayoutEffect(() => { owner.mount(true); return () => owner.mount(false); }, [owner]);
  return owner;
}
export function useWorkerPaddonState<T>(controller: WorkerPaddonState<T>) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const lifecycle = useRef<WorkerPaddonState<T> | null>(null);
  useEffect(() => {
    lifecycle.current = controller;
    const unsubscribe = subscribeSessionWitness(() => { if (!controller.current()) controller.invalidate(); });
    return () => { lifecycle.current = null; unsubscribe(); queueMicrotask(() => { if (lifecycle.current !== controller) controller.invalidate(); }); };
  }, [controller]);
  return state;
}
