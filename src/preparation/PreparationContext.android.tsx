import { Redirect, Stack, router } from 'expo-router';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { loadSession, logout, registerSessionResetHook, type Session } from '../auth';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { PreparationDialogs } from './PreparationUI.android';
import { usePreparationHome } from './usePreparationHome';

type Context = { session: Session; home: ReturnType<typeof usePreparationHome>; onLogout: () => void };
const PreparationContext = createContext<Context | null>(null);

function Provider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const home = usePreparationHome(session);
  return <PreparationContext.Provider value={{ session, home, onLogout }}><PreparationDialogs>{children}</PreparationDialogs></PreparationContext.Provider>;
}

export function PreparationLayout() {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    let mounted = true;
    void loadSession().then(value => { if (mounted) setSession(value); }).catch(() => { if (mounted) setSession(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => registerSessionResetHook(async () => { setSession(null); }), []);
  if (Platform.OS !== 'android' || session === null || (session && (session.profile.role !== 'tayyorlov_masteri' || !session.capabilities.includes('preparation.access')))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const onLogout = () => {
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => { setSession(null); router.replace('/'); });
  };
  return <WorkerSecurityProvider session={session} onLogout={onLogout}>
    <Provider session={session} onLogout={onLogout}><Stack screenOptions={{ headerShown: false }} /></Provider>
  </WorkerSecurityProvider>;
}

export function usePreparationContext() {
  const value = useContext(PreparationContext);
  if (!value) throw new Error('Preparation session unavailable');
  return value;
}
