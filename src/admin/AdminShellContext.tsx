import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes } from '../shared/appRoutes';
import { adminActivityReader } from './adminActivityReader';
import type { AdminActivityBinding } from './adminActivityBinding';
import { adminHomeSummaryReader } from './adminHomeSummaryReader';
import { adminShellMayEnter, adminDestinationPath } from './adminShellAccess';
import { AdminStore } from './adminStore';

type AdminShell = { session: Session; store: AdminStore; onLogout: () => void; isCurrent: () => boolean;
  destination: (route: string, platform: string) => string | null; isRouteAvailable: (route: string) => boolean;
  activityBinding: AdminActivityBinding | null };
const Context = createContext<AdminShell | null>(null);
// Profile and Work Map reads are opt-in guarded; Activity and GScale remain held.
const enabledDestinations: ReadonlySet<string> = new Set([appRoutes.profile, appRoutes.adminProductionMapOrders]);
const activityBinding: AdminActivityBinding | null = null;
export function AdminShellProvider({ session, witness, onLogout, children }: { session: Session; witness: SessionWitness; onLogout: () => void; children: ReactNode }) {
  const scope = useMemo(() => sessionReadScope(session), [session]);
  const isCurrent = useCallback(() => isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && adminShellMayEnter(session), [session, scope, witness]);
  const store = useMemo(() => new AdminStore(adminHomeSummaryReader(session, isCurrent), adminActivityReader(session, isCurrent)), [session, isCurrent]);
  useEffect(() => () => store.clear(), [store]);
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
