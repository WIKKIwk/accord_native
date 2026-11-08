import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { adminApparatus } from '../apparatusApi';
import { registerSessionResetHook, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminRawMaterialHistory } from './materialHistoryApi';
import { materialHistoryCurrent } from './materialHistoryAccess';
import { MaterialHistoryState } from './materialHistoryState';

export function useMaterialHistory(session: Session, witness: SessionWitness) {
  const { controller, current } = useMemo(() => {
    const scope = sessionReadScope(session);
    const current = () => materialHistoryCurrent(session, witness) && sessionReadScope(session) === scope && materialHistoryCurrent(session, witness);
    const guard = (requestCurrent: () => boolean) => () => { if (!requestCurrent() || !current()) throw new Error('Sessiya o‘zgardi.'); };
    const controller = new MaterialHistoryState({ history: request => adminRawMaterialHistory(session, { limit: 100 }, guard(request)),
      apparatus: request => adminApparatus(session, { limit: 10000, beforeSend: guard(request) }), isCurrent: current });
    return { controller, current };
  }, [session, witness]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const onWitness = () => { if (!current()) controller.invalidate(); };
    const unsubscribe = subscribeSessionWitness(onWitness);
    const unregister = registerSessionResetHook(async () => { controller.invalidate(); });
    if (current()) { controller.activate(); void controller.load(); void controller.loadCatalog(); }
    else controller.invalidate();
    return () => { unregister(); unsubscribe(); controller.dispose(); };
  }, [controller, current]);
  return { ...state, allowed: current(), reload: () => controller.load(), refresh: () => controller.load(true) };
}
