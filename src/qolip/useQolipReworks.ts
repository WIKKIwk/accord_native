import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { currentSession, registerSessionResetHook, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { qolipDataRevision } from '../shared/qolipDataRevision';
import { qolipReworks, qolipReturnFromRework } from './qolipReworkApi';
import { newQolipReworkRequestId } from './qolipReworkRequestId';
import { QolipReworksState } from './qolipReworksState';

export function useQolipReworks(session: Session, nextRequestId: () => Promise<string> = newQolipReworkRequestId, isCurrent?: () => boolean) {
  const controller = useMemo(() => new QolipReworksState({
    load: () => qolipReworks(session, 'all', isCurrent),
    returnFromRework: (requestId, reworkIds) => qolipReturnFromRework(session, { requestId, reworkIds }, isCurrent),
    nextRequestId,
    scope: () => { const current = currentSession(); return isCurrent?.() !== false && current ? sessionReadScope(current) : ''; },
    notifyLocationsChanged: () => qolipDataRevision.notifyLocationsChanged(),
  }), [session, nextRequestId, isCurrent]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.dispose(); });
    void controller.load().catch(() => {});
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, groups: controller.groups, controller };
}
