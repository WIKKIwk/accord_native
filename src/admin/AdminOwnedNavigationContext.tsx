import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import { subscribeSessionWitness, type Session } from '../auth';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminOwnedNavigationSession } from './adminOwnedNavigationSession';
import type { AdminOwnedRouteProviders } from './AdminOwnedNavigationTypes';
import { useAdminShell } from './AdminShellContext';

type Value = { owner: AdminOwnedNavigationSession; current: () => boolean; ready: () => boolean; providers: AdminOwnedRouteProviders | null; generation: number; rootPath: string };
const Context = createContext<Value | null>(null);
/** Source-ready providers must be supplied before owned child pages are admitted. */
export function AdminOwnedNavigationProvider({ providers = null, mayEnter, rootPath: workspacePath, children }: { providers?: AdminOwnedRouteProviders | null; mayEnter?: (session: Session | null) => boolean; rootPath?: string; children: ReactNode }) {
  const shell = useAdminShell(), platform = Platform.OS;
  const rootPath = workspacePath ?? `/${platform}-admin`;
  const owner = useMemo(() => new AdminOwnedNavigationSession({ session: shell.session, witness: shell.witness, isCurrent: shell.isCurrent,
    mayEnter,
    sourceReady: () => providers !== null && typeof providers.renderPrimaryAction === 'function' && isSynchronouslyTrue(providers.primaryAvailable),
    push: id => { if (platform !== 'android' && platform !== 'ios') throw new Error('Admin native platform unavailable'); router.push(`${rootPath}/owned/${id}` as Href); },
  }), [shell.session, shell.witness, shell.isCurrent, providers, platform, mayEnter, rootPath]);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useLayoutEffect(() => { owner.activate(); return () => owner.detach(); }, [owner]);
  useEffect(() => { const retire = () => { if (!owner.current()) owner.invalidate(); }; const remove = subscribeSessionWitness(retire); retire(); return remove; }, [owner]);
  const current = useCallback(() => owner.current(snapshot.generation), [owner, snapshot.generation]);
  const ready = useCallback(() => current() && owner.ready(), [current, owner]);
  const value = useMemo(() => ({ owner, current, ready, providers, generation: snapshot.generation, rootPath }), [owner, current, ready, providers, snapshot.generation, rootPath]);
  return <Context.Provider value={value}>{snapshot.active ? children : null}</Context.Provider>;
}
export function useAdminOwnedNavigation() {
  const value = useContext(Context); if (!value) throw new Error('Admin owned navigation unavailable'); return value;
}
