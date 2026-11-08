import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import * as auth from '../auth';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createRawSplitSessionTicket, type RawSplitEpochReader } from './rawSplitApi';
import { RawSplitProvider } from './RawSplitContext';

/** Each native entry and deep link goes through the role/capability and exact-session gate. */
export function RawSplitSessionGate({ platform, children }: { platform: 'ios' | 'android'; children: ReactNode }) {
  const [session, setSession] = useState<auth.Session | null | undefined>();
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true; const version = generation.current;
    void auth.loadSession().then(value => { if (mounted && version === generation.current) setSession(value); })
      .catch(() => { if (mounted && version === generation.current) setSession(null); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => auth.registerSessionResetHook(async () => { generation.current++; setSession(null); }), []);
  if (Platform.OS !== platform || session === null || (session && !canOpenRoute(session, appRoutes.rawMaterialSplit))) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  // This accessor is present on integration main. Missing is a hard failure, never an identity-only fallback.
  const readEpoch = (auth as typeof auth & { activeSessionEpoch?: RawSplitEpochReader }).activeSessionEpoch;
  if (typeof readEpoch !== 'function') return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Sessiya xavfsizligi mavjud emas.</Text></View>;
  const onLogout = () => { void Promise.all([auth.logout(session).catch(() => {}), clearAppLock(session).catch(() => {})])
    .finally(() => { setSession(null); router.replace('/'); }); };
  return <Authorized key={session.imageCacheScope} session={session} readEpoch={readEpoch} onLogout={onLogout}>{children}</Authorized>;
}
function Authorized({ session, readEpoch, onLogout, children }: { session: auth.Session; readEpoch: RawSplitEpochReader; onLogout(): void; children: ReactNode }) {
  const [ticket] = useState(() => { try { return createRawSplitSessionTicket(session, readEpoch); } catch { return null; } });
  if (!ticket) return <Redirect href="/" />;
  return <WorkerSecurityProvider session={session} onLogout={onLogout}><RawSplitProvider session={session} ticket={ticket} onLogout={onLogout}>
    {children}</RawSplitProvider></WorkerSecurityProvider>;
}
