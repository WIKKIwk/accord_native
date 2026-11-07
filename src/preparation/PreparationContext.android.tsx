import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Redirect, Stack, router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { loadSession, logout, registerSessionResetHook, type Session } from '../auth';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { PreparationDialogs } from './PreparationUI.android';
import { usePreparationHome } from './usePreparationHome';
import { PreparationDrawer } from './PreparationDrawer.android';
import { PreparationFabProvider } from './PreparationFab.android';

type Context = { session: Session; home: ReturnType<typeof usePreparationHome>; onLogout: () => void };
const PreparationContext = createContext<Context | null>(null);

function Provider({ session, onLogout, children }: { session: Session; onLogout: () => void; children: ReactNode }) {
  const home = usePreparationHome(session);
  useEffect(() => registerSessionResetHook(async () => { home.controller.invalidate(); }), [home.controller]);
  return <PreparationContext.Provider value={{ session, home, onLogout }}><PreparationDialogs>
    <PreparationDrawer><PreparationFabProvider>{children}</PreparationFabProvider></PreparationDrawer>
  </PreparationDialogs></PreparationContext.Provider>;
}

export function PreparationLayout() {
  const [session, setSession] = useState<Session | null | undefined>();
  const generation = useRef(0);
  const colors = useMaterialColors();
  useEffect(() => {
    let mounted = true; const request = generation.current;
    void loadSession().then(value => { if (mounted && request === generation.current) setSession(value); })
      .catch(() => { if (mounted && request === generation.current) setSession(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => registerSessionResetHook(async () => { generation.current++; setSession(null); }), []);
  if (Platform.OS !== 'android' || session === null || (session && (session.profile.role !== 'tayyorlov_masteri' || !session.capabilities.includes('preparation.access')))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const onLogout = () => {
    void Promise.all([logout(session).catch(() => {}), clearAppLock(session).catch(() => {})]).finally(() => { setSession(null); router.replace('/'); });
  };
  return <WorkerSecurityProvider session={session} onLogout={onLogout}>
    <Provider session={session} onLogout={onLogout}>
      {/* Keep native screens attached behind opaque preparation pages. */}
      <Stack screenOptions={{ headerShown: false, presentation: 'transparentModal',
        contentStyle: { backgroundColor: colors.surfaceContainerLow } }}>
        <Stack.Screen name="index" activityEnabled={false} options={{ presentation: 'card' }} />
      </Stack>
    </Provider>
  </WorkerSecurityProvider>;
}

export function usePreparationContext() {
  const value = useContext(PreparationContext);
  if (!value) throw new Error('Preparation session unavailable');
  return value;
}
