import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { adminApparatus } from '../apparatusApi';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminRawMaterialHistory } from './materialHistoryApi';
import { MaterialHistoryState } from './materialHistoryState';

export function useMaterialHistory(session: Session) {
  const controller = useMemo(() => {
    const scope = sessionReadScope(session);
    const isCurrent = () => !!activeSessionToken(session) && sessionReadScope(session) === scope &&
      canOpenRoute(session, appRoutes.materialHistory);
    const guard = (current: () => boolean) => () => { if (!current()) throw new Error('Sessiya o‘zgardi.'); };
    return new MaterialHistoryState({ history: current => adminRawMaterialHistory(session, { limit: 100 }, guard(current)),
      apparatus: current => adminApparatus(session, { limit: 10000, beforeSend: guard(current) }), isCurrent });
  }, [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate(); void controller.load(); void controller.loadCatalog();
    const unregister = registerSessionResetHook(async () => { controller.invalidate(); });
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, reload: () => controller.load(), refresh: () => controller.load(true) };
}
