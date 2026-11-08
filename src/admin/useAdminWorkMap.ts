import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session } from '../auth';
import { AdminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { AdminWorkMapWorkspace } from './adminWorkMapWorkspace';
import { adminWorkMapCatalogReader, adminWorkMapReader } from './adminWorkMapReader';

export function useAdminWorkMap(session: Session, isCurrent: () => boolean) {
  const group = useMemo(() => {
    const controller = new AdminWorkMapWorkspace({ isCurrent, read: adminWorkMapReader(session, isCurrent),
      readCatalog: adminWorkMapCatalogReader(session, isCurrent),
      selection: new AdminSequenceApparatusStore(undefined, () => String(session.profile.ref ?? '')) });
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
  return { state: state.list, controller: group.controller.window, workspace: group.controller, workspaceState: state };
}
