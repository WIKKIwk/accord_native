import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { router, useRootNavigationState, type Href } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { AdminCreateHubProvider, useAdminCreateHubOwnerCurrent } from '../admin/AdminCreateHubProvider';
import { AdminOwnedNavigationProvider, useAdminOwnedNavigation } from '../admin/AdminOwnedNavigationContext';
import type { AdminOwnedRouteProviders } from '../admin/AdminOwnedNavigationTypes';
import { useAdminShell } from '../admin/AdminShellContext';
import { brigaderMayEnter } from './brigaderAccess';
import { AdminProfileChatAction } from '../admin/AdminProfileChatAction';
import { ChatRouteProvider } from '../shared/chat/ChatRouteContext';
import { brigaderProfileOnStack } from './brigaderProfilePresence';

function OwnedProfilePresence({ onChange }: { onChange: (value: boolean) => void }) {
  const { owner } = useAdminOwnedNavigation(), state = useRootNavigationState();
  useSyncExternalStore(owner.registry.subscribe, owner.registry.getSnapshot, owner.registry.getSnapshot);
  const present = brigaderProfileOnStack(state, `${Platform.OS}-brigader`, id => owner.registry.get(id)?.target.kind === 'profile');
  useLayoutEffect(() => { onChange(present); return () => onChange(false); }, [onChange, present]);
  return null;
}

function OwnedPages({ children, onProfilePresence }: { children: ReactNode; onProfilePresence: (value: boolean) => void }) {
  const current = useAdminCreateHubOwnerCurrent();
  const providers = useMemo<AdminOwnedRouteProviders>(() => ({
    primaryAvailable: current,
    renderPrimaryAction: authority => <BrigaderPrimaryAction {...authority} />,
    renderChatAction: props => <AdminProfileChatAction {...props} />,
  }), [current]);
  return <AdminOwnedNavigationProvider mayEnter={brigaderMayEnter} rootPath={`/${Platform.OS}-brigader`} providers={providers}><OwnedProfilePresence onChange={onProfilePresence} />{children}</AdminOwnedNavigationProvider>;
}

/** One genuine Hub and private argument/result registry for the original Brigader account. */
export function BrigaderNavigationProvider({ children }: { children: ReactNode }) {
  const shell = useAdminShell(), state = useRootNavigationState(), [ownedProfile, setOwnedProfile] = useState(false);
  const profileOnStack = ownedProfile || brigaderProfileOnStack(state, `${Platform.OS}-brigader`);
  const open = useCallback((route: string) => {
    const path = shell.isCurrent() ? shell.destination(route, Platform.OS) : null;
    if (path) router.push(path as Href);
  }, [shell]);
  return <AdminCreateHubProvider session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    isRouteAvailable={shell.isRouteAvailable} onOpenRoute={open} profileOnStack={profileOnStack}>
    <ChatRouteProvider session={shell.session} basePath={`/${Platform.OS}-brigader/chat`} onBack={() => { if (shell.isCurrent() && router.canGoBack()) router.back(); }}><OwnedPages onProfilePresence={setOwnedProfile}>{children}</OwnedPages></ChatRouteProvider>
  </AdminCreateHubProvider>;
}
