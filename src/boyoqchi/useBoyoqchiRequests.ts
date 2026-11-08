import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { adminApparatus } from '../apparatusApi';
import type { Session } from '../auth';
import { BoyoqchiRequestsController } from './boyoqchiController';
import { boyoqchiReturnedPaintRequests } from './returnedPaintApi';

export function useBoyoqchiRequests(session: Session, home: boolean) {
  const controller = useMemo(() => new BoyoqchiRequestsController(() => boyoqchiReturnedPaintRequests(session, 100),
    home ? () => adminApparatus(session, { limit: 10000 }) : null), [session, home]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useFocusEffect(useCallback(() => {
    void controller.refresh();
    if (home) void controller.refreshApparatus();
    return () => controller.cancelPending();
  }, [controller, home]));
  return { state, controller };
}
