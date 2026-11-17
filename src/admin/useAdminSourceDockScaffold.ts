import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useAdminCreateHubSourceController } from './AdminCreateHubProvider';
import { AdminSourceDockScaffoldOwner } from './AdminSourceDockScaffoldOwner';
import type { AdminSourceDockScaffoldProps } from './AdminSourceDockScaffoldTypes';

/** Retains the ORIGINAL page/window owner. Callback/provider replacement cannot retarget native markers. */
export function useAdminSourceDockScaffold(props: AdminSourceDockScaffoldProps) {
  const hub = useAdminCreateHubSourceController();
  const [owner] = useState(() => new AdminSourceDockScaffoldOwner(props, hub));
  useLayoutEffect(() => { if (owner.hub !== hub) owner.invalidate(); else owner.commit(props); });
  const bound = props.rootBinding !== undefined;
  useLayoutEffect(() => { if (!bound) owner.start(); return owner.detach; }, [owner, bound]);
  // Real Root parents reconnect renderer layout leases after their children's layout effects.
  useEffect(() => { if (bound) owner.start(); }, [owner, bound]);
  useLayoutEffect(() => { owner.source(props.primaryTicket, props.thinGestureBottom); }, [owner, props.primaryTicket, props.thinGestureBottom]);
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return { owner, state, matches: owner.hub === hub && owner.matches(props) };
}
