import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { adminApparatus } from '../apparatusApi';
import { activeSessionEpoch, activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { BoyoqchiRequestsController } from './boyoqchiController';
import { boyoqchiReturnedPaintRequests } from './returnedPaintApi';

export function useBoyoqchiRequests(session: Session, home: boolean) {
  const epoch = activeSessionEpoch(session), token = activeSessionToken(session), scope = sessionReadScope(session);
  const controller = useMemo(() => {
    const isCurrent = () => {
      try { return epoch !== null && !!token && activeSessionEpoch(session) === epoch && activeSessionToken(session) === token &&
        sessionReadScope(session) === scope; } catch { return false; }
    };
    return new BoyoqchiRequestsController(() => boyoqchiReturnedPaintRequests(session, 100),
      home ? () => adminApparatus(session, { limit: 10000 }) : null, isCurrent);
  }, [session, home, epoch, token, scope]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    void controller.refresh();
    if (home) void controller.refreshApparatus();
    return () => controller.cancelPending();
  }, [controller, home]);
  return { state, controller };
}
