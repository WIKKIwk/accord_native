import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as auth from '../auth';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { MetalayzerContext } from './MetalayzerContext';

export function MetalayzerSessionGate({ platform, children }: { platform: 'ios' | 'android'; children: ReactNode }) {
  const [session, setSession] = useState<auth.Session | null | undefined>();
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true;
    const version = generation.current;
    void auth.loadSession().then(value => {
      if (mounted && version === generation.current) setSession(value);
    }).catch(() => { if (mounted && version === generation.current) setSession(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => auth.registerSessionResetHook(async () => { generation.current++; setSession(null); }), []);
  if (Platform.OS !== platform || session === null) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!canOpenRoute(session, appRoutes.metalayzer)) return <Redirect href="/" />;
  return <Authorized key={session.imageCacheScope} session={session}>{children}</Authorized>;
}

function Authorized({ session, children }: { session: auth.Session; children: ReactNode }) {
  const [witness] = useState(() => auth.captureSessionWitness(session));
  useSyncExternalStore(auth.subscribeSessionWitness, auth.sessionWitnessVersion, auth.sessionWitnessVersion);
  const isCurrent = () => auth.isSessionWitnessCurrent(witness);
  if (!isCurrent()) return <Redirect href="/" />;
  const onLogout = () => {
    if (!isCurrent()) return;
    void auth.logout(session).then(() => { if (!auth.sessionWitnessTransitioning() && auth.currentSession() === null) router.replace('/'); })
      .catch(() => {});
  };
  return <WorkerSecurityProvider session={session} onLogout={onLogout}>
    <MetalayzerContext.Provider value={{ session, onLogout, isCurrent }}>{children}</MetalayzerContext.Provider>
  </WorkerSecurityProvider>;
}
