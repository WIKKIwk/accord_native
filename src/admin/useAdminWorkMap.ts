import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session } from '../auth';
import { AdminWorkMapController } from './adminWorkMapController';
import { adminWorkMapReader } from './adminWorkMapReader';

export function useAdminWorkMap(session: Session, isCurrent: () => boolean) {
  const group = useMemo(() => {
    const controller = new AdminWorkMapController({ isCurrent, read: adminWorkMapReader(session, isCurrent) });
    let mounts = 0;
    return { controller, mount() { mounts++; controller.start(); return () => { mounts--; queueMicrotask(() => { if (!mounts) controller.dispose(); }); }; } };
  }, [session, isCurrent]);
  const state = useSyncExternalStore(group.controller.subscribe, group.controller.getSnapshot, group.controller.getSnapshot);
  useEffect(() => {
    const stopWitness = subscribeSessionWitness(() => { if (!isCurrent()) group.controller.invalidate(); });
    if (!isCurrent()) group.controller.invalidate();
    const stopController = group.mount();
    return () => { stopWitness(); stopController(); };
  }, [group, isCurrent]);
  return { state, controller: group.controller };
}
