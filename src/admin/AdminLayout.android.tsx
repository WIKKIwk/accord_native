import { Redirect, Stack } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { isSessionWitnessCurrent, logout, sessionWitnessVersion, subscribeSessionWitness } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { AdminDrawer } from './AdminDrawer';
import { AdminTestTokenNotice } from './AdminTestTokenNotice';
import { AdminShellProvider } from './AdminShellContext';
import { adminShellMayEnter } from './adminShellAccess';
import { useAdminShellSession } from './useAdminShellSession';

function AdminSessionGate() {
  const admission = useAdminShellSession(), session = admission?.session, witness = admission?.witness;
  const onLogout = useCallback(() => {
    if (session && isSessionWitnessCurrent(witness)) {
      if (session.token !== 'test-mode-token') void logout(session).catch(() => {});
    }
  }, [session, witness]);
  if (Platform.OS !== 'android' || admission === null) return <Redirect href="/" />;
  if (!session || !witness || !isSessionWitnessCurrent(witness)) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!adminShellMayEnter(session)) return <Redirect href="/" />;
  if (session.token === 'test-mode-token') return <AdminTestTokenNotice />;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <AdminShellProvider session={session} witness={witness} onLogout={onLogout}><AdminDrawer><Stack screenOptions={{ headerShown: false }} /></AdminDrawer></AdminShellProvider>
  </WorkerSecurityProvider>;
}

/** A witness version change creates a new admission gate; stale operations are never recaptured. */
export function AdminLayout() {
  const version = useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  return <AdminSessionGate key={version} />;
}
