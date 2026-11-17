import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import { AdminShellContextProvider } from '../admin/AdminShellContext';
import { AdminStore } from '../admin/adminStore';
import { adminHomeSummaryReader } from '../admin/adminHomeSummaryReader';
import { adminActivityReader } from '../admin/adminActivityReader';
import { createAdminActivityBinding } from '../admin/adminActivityBinding';
import { brigaderSessionLease, createBrigaderSession } from './brigaderSession';

/** V2 uses the same AdminStore and screens for Brigader, without changing the profile's role or grants. */
export function BrigaderShellProvider({ session, witness, onLogout, children }: {
  session: Session; witness: SessionWitness; onLogout: () => void; children: ReactNode;
}) {
  const owner = useMemo(() => createBrigaderSession(session, witness), [session, witness]);
  const store = useMemo(() => new AdminStore(adminHomeSummaryReader(session, owner.isCurrent), adminActivityReader(session, owner.isCurrent)), [session, owner]);
  const activityBinding = useMemo(() => createAdminActivityBinding(session, witness), [session, witness]);
  const mount = useMemo(() => brigaderSessionLease(owner, () => store.clear()), [owner, store]);
  useEffect(mount, [mount]);
  const isRouteAvailable = useCallback((route: string) => !!owner.destination(route, 'ios') || !!owner.destination(route, 'android'), [owner]);
  const value = useMemo(() => ({ session, witness, store, onLogout, isCurrent: owner.isCurrent,
    destination: owner.destination, isRouteAvailable, activityBinding }), [session, witness, store, onLogout, owner, isRouteAvailable, activityBinding]);
  return <AdminShellContextProvider value={value}>{children}</AdminShellContextProvider>;
}
