import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { isSessionWitnessCurrent, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { AdminDrawer } from '../admin/AdminDrawer';
import { useAdminShell } from '../admin/AdminShellContext';
import { AdminShellNoticeProvider } from '../admin/AdminShellNoticeProvider';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { brigaderMayEnter } from './brigaderAccess';
import { BrigaderShellProvider } from './BrigaderShellProvider';
import { useBrigaderSession } from './useBrigaderSession';
import { logoutBrigader } from './brigaderLogout';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

function BrigaderTabs() {
  const shell = useAdminShell();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const showActivity = !!shell.activityBinding && !!shell.destination(appRoutes.adminActivity, 'ios');
  // Source Users and Create depend on the unfinished shared Admin compositions.
  return <NativeTabs>
    <NativeTabs.Trigger name="(home)">
      <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      <NativeTabs.Trigger.Label>{localizedGetter('adminHomeNavTitle', locale)}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="activity" hidden={!showActivity}>
      <NativeTabs.Trigger.Icon sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }} />
      <NativeTabs.Trigger.Label>{localizedGetter('adminActivityNavTitle', locale)}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>;
}

function BrigaderSessionGate() {
  const admission = useBrigaderSession(), session = admission?.session, witness = admission?.witness;
  const isCurrent = useCallback(() => !!session && isSessionWitnessCurrent(witness) && brigaderMayEnter(session), [session, witness]);
  const onLogout = useCallback(() => {
    if (session && witness && isSessionWitnessCurrent(witness)) void logoutBrigader(session, witness).catch(() => {});
  }, [session, witness]);
  if (Platform.OS !== 'ios' || admission === null) return <Redirect href="/" />;
  if (!session || !witness || !isSessionWitnessCurrent(witness)) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  if (!brigaderMayEnter(session)) return <Redirect href="/" />;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout} isCurrent={isCurrent}>
    <BrigaderShellProvider session={session} witness={witness} onLogout={onLogout}>
      <AdminShellNoticeProvider mayEnter={brigaderMayEnter}><AdminDrawer><BrigaderTabs /></AdminDrawer></AdminShellNoticeProvider>
    </BrigaderShellProvider>
  </WorkerSecurityProvider>;
}

/** A session transition retires the original gate before another account can enter. */
export function BrigaderLayout() {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return <BrigaderSessionGate key={version} />;
}
