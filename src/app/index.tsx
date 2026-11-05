import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { LoginScreen } from '../LoginScreen';
import { WorkerScreen } from '../WorkerScreen';
import { loadSession, logout, type Session } from '../auth';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { homeTarget } from '../shared/appRoutes';

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadSession().then(value => { if (active) setSession(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <LoginScreen onLogin={setSession} />;
  const target = homeTarget(session, Platform.OS);
  if (target && target !== 'worker') return <Redirect href={target} />;
  if (!target) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Ushbu rol uchun Accord V2 ilovasidan foydalanishda davom eting.</Text>
  </View>;
  const onLogout = () => {
    setLoading(true);
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => {
      setSession(null);
      setLoading(false);
    });
  };
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <WorkerScreen session={session} onLogout={onLogout} />
  </WorkerSecurityProvider>;
}
