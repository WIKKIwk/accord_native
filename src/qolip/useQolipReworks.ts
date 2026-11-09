import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { currentSession, registerSessionResetHook, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { qolipReworks, qolipReturnFromRework } from './qolipReworkApi';
import { QolipReworksState } from './qolipReworksState';

export function useQolipReworks(session: Session, nextRequestId: () => Promise<string>) {
  const controller = useMemo(() => new QolipReworksState({
    load: () => qolipReworks(session, 'all'),
    returnFromRework: (requestId, reworkIds) => qolipReturnFromRework(session, { requestId, reworkIds }),
    nextRequestId,
    scope: () => { const current = currentSession(); return current ? sessionReadScope(current) : ''; },
    notifyLocationsChanged: () => qolipDataRevision.notifyLocationsChanged(),
  }), [session, nextRequestId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.dispose(); });
    void controller.load().catch(() => {});
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, groups: controller.groups, controller };
}
