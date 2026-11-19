import { Redirect, usePathname } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { isSessionWitnessCurrent, logout, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes } from '../shared/appRoutes';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleTabs, roleTabIcons } from '../shared/navigation/RoleTabs.ios';
import { AdminDrawer } from './AdminDrawer';
import { AdminTestTokenNotice } from './AdminTestTokenNotice';
import { AdminShellProvider, useAdminShell } from './AdminShellContext';
import { adminShellMayEnter } from './adminShellAccess';
import { useAdminShellSession } from './useAdminShellSession';
import { AdminOwnedNavigationProvider } from './AdminOwnedNavigationContext';
import { AdminShellNoticeProvider } from './AdminShellNoticeProvider';
import { adminDockChatDestination } from './adminDockModel';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function AdminTabs() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const unread = useChatUnreadCount(shell.session);
  const pathname = usePathname(), ownedDock = pathname === '/ios-admin/users' || pathname.startsWith('/ios-admin/owned/');
  const showActivity = !!shell.activityBinding && !!shell.destination(appRoutes.adminActivity, 'ios');
  const showChat = !!shell.destination(appRoutes.chat, 'ios');
  return <RoleTabs hidden={ownedDock} tabs={[
    { name: '(home)', label: localizedGetter('adminHomeNavTitle', locale), icon: roleTabIcons.home },
    { name: 'activity', label: localizedGetter('adminActivityNavTitle', locale), icon: 'clock.arrow.circlepath', hidden: !showActivity },
    { name: 'chat', label: adminDockChatDestination.label, icon: roleTabIcons.chat, hidden: !showChat, showBadge: unread > 0 },
  ]} />;
}
function AdminSessionGate() {
  const admission = useAdminShellSession(), session = admission?.session, witness = admission?.witness;
  const onLogout = useCallback(() => {
    if (session && isSessionWitnessCurrent(witness)) {
      if (session.token !== 'test-mode-token') void logout(session).catch(() => {});
    }
  }, [session, witness]);
  if (Platform.OS !== 'ios' || admission === null) return <Redirect href="/" />;
  if (!session || !witness || !isSessionWitnessCurrent(witness)) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!adminShellMayEnter(session)) return <Redirect href="/" />;
  if (session.token === 'test-mode-token') return <AdminTestTokenNotice />;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <AdminShellProvider session={session} witness={witness} onLogout={onLogout}><AdminShellNoticeProvider><AdminOwnedNavigationProvider><AdminDrawer><AdminTabs /></AdminDrawer></AdminOwnedNavigationProvider></AdminShellNoticeProvider></AdminShellProvider>
  </WorkerSecurityProvider>;
}

/** A witness version change creates a new admission gate; stale operations are never recaptured. */
export function AdminLayout() {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return <AdminSessionGate key={version} />;
}
