import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes } from '../shared/appRoutes';
import { adminActivityReader } from './adminActivityReader';
import { createAdminActivityBinding, type AdminActivityBinding } from './adminActivityBinding';
import { adminHomeSummaryReader } from './adminHomeSummaryReader';
import { adminShellMayEnter, adminDestinationPath } from './adminShellAccess';
import { AdminStore } from './adminStore';

type AdminShell = { session: Session; witness: SessionWitness; store: AdminStore; onLogout: () => void; isCurrent: () => boolean;
  destination: (route: string, platform: string) => string | null; isRouteAvailable: (route: string) => boolean;
  activityBinding: AdminActivityBinding | null };
const Context = createContext<AdminShell | null>(null);
// Admission and each destination retain their existing account/capability guards.
const enabledDestinations: ReadonlySet<string> = new Set([appRoutes.adminHome, appRoutes.profile,
  appRoutes.adminProductionMapOrders, appRoutes.adminActivity, appRoutes.adminFactoryLocations,
  appRoutes.adminSettings, appRoutes.adminAdditionalSettings, appRoutes.adminItemGroupCreate, appRoutes.adminInactiveSuppliers,
  appRoutes.adminQueuePolicies, appRoutes.adminRoles]);
export function AdminShellProvider({ session, witness, onLogout, children }: { session: Session; witness: SessionWitness; onLogout: () => void; children: ReactNode }) {
  const scope = useMemo(() => sessionReadScope(session), [session]);
  const isCurrent = useCallback(() => isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && adminShellMayEnter(session), [session, scope, witness]);
  const store = useMemo(() => new AdminStore(adminHomeSummaryReader(session, isCurrent), adminActivityReader(session, isCurrent)), [session, isCurrent]);
  const activityBinding = useMemo(() => createAdminActivityBinding(session, witness), [session, witness]);
  useEffect(() => () => store.clear(), [store]);
  const destination = useCallback((route: string, platform: string) => isCurrent()
    ? adminDestinationPath(session, route, platform, enabledDestinations) : null, [session, isCurrent]);
  const isRouteAvailable = useCallback((route: string) => !!destination(route, 'ios') || !!destination(route, 'android'), [destination]);
  const value = useMemo(() => ({ session, witness, store, onLogout, isCurrent, destination, isRouteAvailable, activityBinding }),
    [session, witness, store, onLogout, isCurrent, destination, isRouteAvailable, activityBinding]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAdminShell() {
  const value = useContext(Context);
  if (!value) throw new Error('Admin session unavailable');
  return value;
}
