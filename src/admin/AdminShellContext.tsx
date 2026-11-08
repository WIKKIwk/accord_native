import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminActivityReader } from './adminActivityReader';
import type { AdminActivityBinding } from './adminActivityBinding';
import { adminHomeSummaryReader } from './adminHomeSummaryReader';
import { adminShellMayEnter, adminDestinationPath } from './adminShellAccess';
import { AdminStore } from './adminStore';

type AdminShell = { session: Session; store: AdminStore; onLogout: () => void; isCurrent: () => boolean;
  destination: (route: string, platform: string) => string | null; isRouteAvailable: (route: string) => boolean;
  activityBinding: AdminActivityBinding | null };
const Context = createContext<AdminShell | null>(null);
// The shared transition witness/event must be integrated before Profile or GScale is enabled here.
const enabledDestinations: ReadonlySet<string> = new Set();
const activityBinding: AdminActivityBinding | null = null;
export function AdminShellProvider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const scope = useMemo(() => sessionReadScope(session), [session]);
  const store = useMemo(() => new AdminStore(adminHomeSummaryReader(session), adminActivityReader(session)), [session]);
  useEffect(() => () => store.clear(), [store]);
  const isCurrent = useCallback(() => !!activeSessionToken(session) && sessionReadScope(session) === scope && adminShellMayEnter(session), [session, scope]);
  const destination = useCallback((route: string, platform: string) => isCurrent()
    ? adminDestinationPath(session, route, platform, enabledDestinations) : null, [session, isCurrent]);
  const isRouteAvailable = useCallback((route: string) => !!destination(route, 'ios') || !!destination(route, 'android'), [destination]);
  const value = useMemo(() => ({ session, store, onLogout, isCurrent, destination, isRouteAvailable, activityBinding }),
    [session, store, onLogout, isCurrent, destination, isRouteAvailable]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminShell() {
  const value = useContext(Context);
  if (!value) throw new Error('Admin session unavailable');
  return value;
}
