import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { captureSessionWitness, isSessionWitnessCurrent, subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminWipBatches } from '../workerWipApi';
import { WorkerPeremotka, workerPeremotkaRows } from '../workerPeremotka';
import { useWorkerOrderText } from './useWorkerOrderText';

function createOwner(session: Session, apparatus: string, scope: string) {
  const witness = captureSessionWitness(session);
  let mounted = false;
  const current = () => mounted && !!apparatus && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && session.assigned_apparatus.some(id => id.trim() === apparatus);
  const controller = new WorkerPeremotka({ current, read: (signal, valid) => adminWipBatches(session, { apparatus, status: 'peremotka', limit: 500, signal, current: valid }) });
  return { controller, current, mount: (value: boolean) => { mounted = value; } };
}

export function useWorkerPeremotka(session: Session, apparatus: string, visible: boolean) {
  const { p } = useWorkerOrderText(), scope = sessionReadScope(session);
  const owner = useMemo(() => createOwner(session, apparatus, scope), [session, apparatus, scope]), { controller } = owner;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    owner.mount(true);
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) controller.invalidate(); });
    return () => { owner.mount(false); controller.invalidate(); unsubscribe(); };
  }, [owner, controller]);
  useFocusEffect(useCallback(() => { controller.setVisible(visible); return () => controller.setVisible(false); }, [controller, visible]));
  return { state, controller, rows: workerPeremotkaRows(state.batches, p), title: p('worker.rezka.print.peremotka'),
    error: p('worker.error.sync'), empty: p('worker.rezka.print.peremotka_empty') };
}
