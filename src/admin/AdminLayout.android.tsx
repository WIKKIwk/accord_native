import { Redirect, Stack } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { activeSessionToken, logout } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { AdminDrawer } from './AdminDrawer';
import { AdminShellProvider } from './AdminShellContext';
import { adminShellMayEnter } from './adminShellAccess';
import { useAdminShellSession } from './useAdminShellSession';

export function AdminLayout() {
  const session = useAdminShellSession();
  const onLogout = useCallback(() => { if (session && activeSessionToken(session)) void logout(session).catch(() => {}); }, [session]);
  if (Platform.OS !== 'android' || session === null || (session && (!activeSessionToken(session) || !adminShellMayEnter(session)))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <AdminShellProvider session={session} onLogout={onLogout}><AdminDrawer><Stack screenOptions={{ headerShown: false }} /></AdminDrawer></AdminShellProvider>
  </WorkerSecurityProvider>;
}
