import { Redirect, Stack, router } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';
import { clearAppLock } from '../appLock';
import { currentSession, isSessionWitnessCurrent, logout } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { canEnterBoyoqchi } from './boyoqchiEntryGuard';
import { switchPinStore } from '../shared/switchPinRuntime';
import { BoyoqchiContextShell } from './BoyoqchiShell';
import { useBoyoqchiSession } from './useBoyoqchiSession';
export function BoyoqchiLayout() {
  const { witness, mounted } = useBoyoqchiSession();
  if (Platform.OS !== 'android' || witness === null) return <Redirect href="/" />;
  if (!witness) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const session = witness.session;
  if (!canEnterBoyoqchi(session, Platform.OS, 'android')) return <Redirect href="/" />;
  const onLogout = () => {
    if (!isSessionWitnessCurrent(witness)) return;
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {}),
      switchPinStore.clear(session).catch(() => {})]).finally(() => {
      const current = currentSession();
      if (mounted.current && (!current || current === session)) router.replace('/');
    });
  };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <BoyoqchiContextShell session={session} witness={witness} onLogout={onLogout}><Stack screenOptions={{ headerShown: false }} /></BoyoqchiContextShell>
  </WorkerSecurityProvider>;
}
