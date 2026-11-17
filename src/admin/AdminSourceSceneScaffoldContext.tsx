import { createContext, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useOptionalAdminRootRouterPage } from './AdminRootRouterContext';
import type { AdminRootRouterBinding } from './AdminRootRouterTypes';
import type { AdminSourceDockScaffoldOwner } from './AdminSourceDockScaffoldOwner';
import { AdminSourceSceneScaffoldOwner } from './AdminSourceSceneScaffoldOwner';
import { useAdminTopNoticeTarget } from './AdminTopNoticeProvider';

const Context = createContext<AdminSourceSceneScaffoldOwner | null>(null);
const Placement = createContext(false);
function Bound({ source, binding, available, children }: { source: AdminSourceDockScaffoldOwner; binding: AdminRootRouterBinding; available: boolean; children: ReactNode }) {
  const root = useOptionalAdminRootRouterPage(), target = useAdminTopNoticeTarget();
  const original = root ? { root, target, source, binding } : null, [owner] = useState(() => original && available ? new AdminSourceSceneScaffoldOwner(original) : null);
  const matches = !!owner && !!original && available && owner.matches(original);
  useLayoutEffect(() => { if (owner) { if (!original || !available) owner.invalidate(); else owner.commit(original); } });
  useLayoutEffect(() => owner?.attach(), [owner]);
  useEffect(() => { owner?.start(); }, [owner]);
  useSyncExternalStore(owner?.subscribe ?? emptySubscribe, owner?.getSnapshot ?? emptySnapshot, owner?.getSnapshot ?? emptySnapshot);
  // A replacement cannot expose the old active owner to child layout effects before this parent commits retirement.
  return <Context.Provider value={matches ? owner : null}>{children}</Context.Provider>;
}
/** Must wrap ONLY the actual nativeScene, never its outlet. Missing explicit binding clears any physically inherited Source scene. */
export function AdminSourceSceneScaffoldProvider({ source, binding, available = true, children }: { source: AdminSourceDockScaffoldOwner; binding?: AdminRootRouterBinding; available?: boolean; children: ReactNode }) {
  return <Placement.Provider value={true}>{binding ? <Bound source={source} binding={binding} available={available}>{children}</Bound> : <Context.Provider value={null}>{children}</Context.Provider>}</Placement.Provider>;
}
export function useAdminSourceSceneScaffold() { return useContext(Context); }
export function useAdminSourceScenePlacement() { return useContext(Placement); }
const emptySubscribe = () => () => {}, emptySnapshot = () => null;
