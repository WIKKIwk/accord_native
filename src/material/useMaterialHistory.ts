import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { adminApparatus } from '../apparatusApi';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminRawMaterialHistory } from './materialHistoryApi';
import { MaterialHistoryState } from './materialHistoryState';

export function useMaterialHistory(session: Session) {
  const controller = useMemo(() => {
    const scope = sessionReadScope(session);
    return new MaterialHistoryState({ history: () => adminRawMaterialHistory(session, { limit: 100 }),
      apparatus: () => adminApparatus(session, { limit: 10000 }),
      isCurrent: () => !!activeSessionToken(session) && sessionReadScope(session) === scope });
  }, [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate(); void controller.load(); void controller.loadCatalog();
    const unregister = registerSessionResetHook(async () => { controller.invalidate(); });
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, reload: () => controller.load(), refresh: () => controller.load(true) };
}
