import { Redirect, Stack } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { isSessionWitnessCurrent, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { AdminDrawer } from '../admin/AdminDrawer';
import { AdminShellNoticeProvider } from '../admin/AdminShellNoticeProvider';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { brigaderMayEnter } from './brigaderAccess';
import { BrigaderShellProvider } from './BrigaderShellProvider';
import { BrigaderNavigationProvider } from './BrigaderNavigationProvider';
import { useBrigaderSession } from './useBrigaderSession';
import { logoutBrigader } from './brigaderLogout';

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
      <AdminShellNoticeProvider mayEnter={brigaderMayEnter}><BrigaderNavigationProvider><AdminDrawer><Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }} /></AdminDrawer></BrigaderNavigationProvider></AdminShellNoticeProvider>
    </BrigaderShellProvider>
  </WorkerSecurityProvider>;
}

/** A session transition retires the original gate before another account can enter. */
export function BrigaderLayout() {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return <BrigaderSessionGate key={version} />;
}
