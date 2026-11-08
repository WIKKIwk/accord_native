import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import * as auth from '../auth';
import { clearAppLock } from '../appLock';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createRawSplitSessionTicket, type RawSplitEpochReader } from './rawSplitApi';
import { RawSplitProvider } from './RawSplitContext';

type WitnessBindings = { activeSessionEpoch: RawSplitEpochReader; captureSessionWitness(session: auth.Session): unknown;
  isSessionWitnessCurrent(witness: unknown): boolean; subscribeSessionWitness(listener: () => void): () => void; sessionWitnessVersion(): number };
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
  if (session.token === 'test-mode-token') return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text>Demo/test rejimi hozir mavjud emas.</Text></View>;
  const onLogout = () => { void Promise.all([auth.logout(session).catch(() => {}), clearAppLock(session).catch(() => {})])
    .finally(() => { setSession(null); router.replace('/'); }); };
  // Main supplies these APIs. Missing bindings fail closed; no substitute or identity-only fallback exists.
  const bindings = auth as unknown as Partial<WitnessBindings>;
  if (typeof bindings.activeSessionEpoch !== 'function' || typeof bindings.captureSessionWitness !== 'function' ||
      typeof bindings.isSessionWitnessCurrent !== 'function' || typeof bindings.subscribeSessionWitness !== 'function' ||
      typeof bindings.sessionWitnessVersion !== 'function') return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Sessiya xavfsizligi mavjud emas.</Text></View>;
  return <Authorized key={session.imageCacheScope} session={session} bindings={bindings as WitnessBindings} onLogout={onLogout}>{children}</Authorized>;
}
function Authorized({ session, bindings, onLogout, children }: { session: auth.Session; bindings: WitnessBindings; onLogout(): void; children: ReactNode }) {
  const [ticket] = useState(() => {
    try {
      const witness = bindings.captureSessionWitness(session); if (witness == null) return null;
      return createRawSplitSessionTicket(session, bindings.activeSessionEpoch, () => bindings.isSessionWitnessCurrent(witness));
    } catch { return null; }
  });
  if (!ticket) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text>Sessiya o‘zgargan. Sahifani qayta oching.</Text><WorkerSheetButton label="Bosh sahifa" onPress={() => router.replace('/')} /></View>;
  return <WorkerSecurityProvider session={session} onLogout={onLogout}><RawSplitProvider session={session} ticket={ticket} onLogout={onLogout}
    subscribeWitness={bindings.subscribeSessionWitness} witnessVersion={bindings.sessionWitnessVersion}>{children}</RawSplitProvider></WorkerSecurityProvider>;
}
