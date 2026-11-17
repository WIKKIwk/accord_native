import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook, type Session } from '../auth';
import { QolipMileageState } from './qolipMileageState';

export function useQolipMileage(session: Session, code: string, guard?: () => boolean) {
  const controller = useMemo(() => QolipMileageState.forSession(session, code, guard), [session, code, guard]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.dispose(); });
    void controller.load().catch(() => {});
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, controller };
}
