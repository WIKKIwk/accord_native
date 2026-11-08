import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { activeSessionToken, logout } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminDrawer } from './AdminDrawer';
import { AdminShellProvider, useAdminShell } from './AdminShellContext';
import { adminShellMayEnter } from './adminShellAccess';
import { useAdminShellSession } from './useAdminShellSession';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function AdminTabs() {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const showActivity = !!shell.activityBinding && !!shell.destination(appRoutes.adminActivity, 'ios');
  return <NativeTabs>
    <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      <NativeTabs.Trigger.Label>{localizedGetter('adminHomeNavTitle', locale)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="activity" hidden={!showActivity}><NativeTabs.Trigger.Icon sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }} />
      <NativeTabs.Trigger.Label>{localizedGetter('adminActivityNavTitle', locale)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
export function AdminLayout() {
  const session = useAdminShellSession();
  const onLogout = useCallback(() => { if (session && activeSessionToken(session)) void logout(session).catch(() => {}); }, [session]);
  if (Platform.OS !== 'ios' || session === null || (session && (!activeSessionToken(session) || !adminShellMayEnter(session)))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <AdminShellProvider session={session} onLogout={onLogout}><AdminDrawer><AdminTabs /></AdminDrawer></AdminShellProvider>
  </WorkerSecurityProvider>;
}
