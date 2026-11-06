import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { AppEntry } from '../components/AppEntry';
import { WorkerScreen } from '../WorkerScreen';
import { activeSessionToken, loadSession, logout, type Session } from '../auth';
import { profile } from '../profileApi';
import { bootstrapSession, loadBaseStartup } from '../shared/loginLogic';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { homeTarget } from '../shared/appRoutes';
import { switchPinStore } from '../shared/switchPinRuntime';
import { notificationUnreadStore } from '../shared/notificationStoresRuntime';
import { initializeBasePreferences } from '../shared/basePreferences';
import { unlockAfterLogin } from '../shared/securityUnlockRuntime';
import '../shared/productionSnapshotRuntime';

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    bootstrapSession(() => loadBaseStartup(loadSession, [() => notificationUnreadStore.load(),
      initializeBasePreferences]), profile, value => !!activeSessionToken(value))
      .then(value => { if (active) setSession(value); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <AppEntry onLogin={value => { unlockAfterLogin(value); setSession(value); }} />;
  const target = homeTarget(session, Platform.OS);
  if (target && target !== 'worker') return <Redirect href={target} />;
  if (!target) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Ushbu rol uchun Accord V2 ilovasidan foydalanishda davom eting.</Text>
  </View>;
  const onLogout = () => {
    setLoading(true);
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {}),
      switchPinStore.clear(session).catch(() => {})]).finally(() => {
      setSession(null);
      setLoading(false);
    });
  };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <WorkerScreen session={session} onLogout={onLogout} />
  </WorkerSecurityProvider>;
}
