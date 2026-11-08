import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { isSessionWitnessCurrent, logout, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { AdminDrawer } from './AdminDrawer';
import { AdminTestTokenNotice } from './AdminTestTokenNotice';
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
    <AdminShellProvider session={session} witness={witness} onLogout={onLogout}><AdminDrawer><AdminTabs /></AdminDrawer></AdminShellProvider>
  </WorkerSecurityProvider>;
}

/** A witness version change creates a new admission gate; stale operations are never recaptured. */
export function AdminLayout() {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return <AdminSessionGate key={version} />;
}
