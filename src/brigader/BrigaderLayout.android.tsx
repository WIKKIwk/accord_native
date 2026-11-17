import { Redirect, Stack } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { isSessionWitnessCurrent, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { AdminDrawer } from '../admin/AdminDrawer';
import { AdminShellNoticeProvider } from '../admin/AdminShellNoticeProvider';
import { AdminTypographyProvider } from '../admin/AdminTypography.android';
import { BrigaderShellProvider } from './BrigaderShellProvider';
import { BrigaderNavigationProvider } from './BrigaderNavigationProvider';
import { BrigaderNativePage } from './BrigaderFeedbackProvider';
import { brigaderMayEnter } from './brigaderAccess';
import { useBrigaderSession } from './useBrigaderSession';
import { logoutBrigader } from './brigaderLogout';

function BrigaderSessionGate() {
  const admission = useBrigaderSession(), session = admission?.session, witness = admission?.witness;
  const isCurrent = useCallback(() => !!session && isSessionWitnessCurrent(witness) && brigaderMayEnter(session), [session, witness]);
  const onLogout = useCallback(() => {
    if (session && witness && isCurrent()) void logoutBrigader(session, witness).catch(() => {});
  }, [session, witness, isCurrent]);
  if (Platform.OS !== 'android' || admission === null) return <Redirect href="/" />;
  if (!session || !witness || !isSessionWitnessCurrent(witness)) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!brigaderMayEnter(session)) return <Redirect href="/" />;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout} isCurrent={isCurrent}>
    <BrigaderShellProvider session={session} witness={witness} onLogout={onLogout}>
      <AdminShellNoticeProvider mayEnter={brigaderMayEnter}><BrigaderNavigationProvider><AdminDrawer><Stack screenLayout={({ children }) => <BrigaderNativePage>{children}</BrigaderNativePage>} screenOptions={{ headerShown: false }} /></AdminDrawer></BrigaderNavigationProvider></AdminShellNoticeProvider>
    </BrigaderShellProvider>
  </WorkerSecurityProvider>;
}

/** A replaced account owns a new gate; an expired operation never acquires its replacement witness. */
export function BrigaderLayout() {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return <AdminTypographyProvider><BrigaderSessionGate key={version} /></AdminTypographyProvider>;
}
