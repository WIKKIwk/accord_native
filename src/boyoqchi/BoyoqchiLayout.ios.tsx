import { Redirect, Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { clearAppLock } from '../appLock';
import { loadSession, logout, registerSessionResetHook, type Session } from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { canEnterBoyoqchi } from './boyoqchiEntryGuard';
import { switchPinStore } from '../shared/switchPinRuntime';
import { BoyoqchiContextShell } from './BoyoqchiShell';
export function BoyoqchiLayout() {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    let active = true;
    void loadSession().then(value => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    const unregister = registerSessionResetHook(async () => { if (active) setSession(null); });
    return () => { active = false; unregister(); };
  }, []);
  if (Platform.OS !== 'ios' || session === null) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!canEnterBoyoqchi(session, Platform.OS, 'ios')) return <Redirect href="/" />;
  const onLogout = () => { void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {}),
    switchPinStore.clear(session).catch(() => {})]).finally(() => { setSession(null); router.replace('/'); }); };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <BoyoqchiContextShell session={session} onLogout={onLogout}><Stack screenOptions={{ headerShown: false }} /></BoyoqchiContextShell>
  </WorkerSecurityProvider>;
}
