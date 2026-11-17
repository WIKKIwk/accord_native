import { Stack, router, type Href } from 'expo-router';
import { View, Platform } from 'react-native';
import { WorkerScreen } from '../WorkerScreen';
import { DailyWorkScreen } from '../components/DailyWorkScreen';
import { WorkerWorkInstructions } from '../components/WorkerWorkInstructions';
import { WorkerPaddonDetail } from '../components/WorkerPaddonDetail';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { appRoutes } from '../shared/appRoutes';
import { useBrigaderFeature } from './BrigaderFeatureContext';
import { BrigaderApparatusDock } from './BrigaderApparatusDock';
import { BrigaderPaddons } from './BrigaderPaddons';
import type { WorkerPaddonDetailSeed } from '../workerPaddonDetailSeed';
export function BrigaderApparatusPage({ kind }: { kind:'queue'|'daily'|'instructions'|'detail' }) {
  const route = kind === 'queue' ? appRoutes.apparatusQueue : kind === 'daily' ? appRoutes.apparatusDailyWork : kind === 'instructions' ? appRoutes.apparatusWorkInstructions : appRoutes.apparatusPaddonDetail;
  const page = useBrigaderFeature(route), drawer = useRoleDrawer(), args = page.args as { code?:string;apparatusId?:string;apparatusName?:string;initialSnapshot?:WorkerPaddonDetailSeed;qrPayload?:string } | string | undefined;
  const open = (route:string) => { const path = page.interactive() ? page.shell.destination(route,Platform.OS) : null; if (path) router.push(path as Href); };
  const select = (id:string) => { const route = id === 'profile' ? appRoutes.profile : id === 'daily' ? appRoutes.apparatusDailyWork : id === 'instructions' ? appRoutes.apparatusWorkInstructions : id === 'transfer' ? appRoutes.inventoryMovements : id === 'paddons' ? appRoutes.apparatusPaddons : null; if (route) { open(route); return true; } return false; };
  if (!page.current()) return null;
  const code = typeof args === 'string' ? args : args?.code ?? '';
  if (kind === 'detail' && !code.trim()) return <BrigaderPaddons />;
  return <View style={{ flex:1 }}><Stack.Screen options={{ headerShown:kind === 'instructions' || kind === 'detail' }} />
    {kind === 'queue' ? <WorkerScreen session={page.shell.session} onLogout={page.shell.onLogout} nativeNavigation onOpenDrawer={drawer.open} onSelectDestination={select} initialQr={typeof args === 'object' ? args.qrPayload : undefined} /> : kind === 'daily' ? <DailyWorkScreen session={page.shell.session} onBack={page.back} onOpenDrawer={drawer.open} /> : kind === 'instructions' ? <WorkerWorkInstructions session={page.shell.session} onBack={page.back} /> : <WorkerPaddonDetail session={page.shell.session} code={code} apparatus={typeof args === 'object' ? args.apparatusId : undefined} initialSnapshot={typeof args === 'object' ? args.initialSnapshot : undefined} onBack={page.back} />}
    <View pointerEvents="box-none" style={{ position:'absolute',left:0,right:0,bottom:0 }}><BrigaderApparatusDock primary={kind === 'daily' || kind === 'instructions'} active={kind === 'queue' ? 'home' : ''} /></View>
  </View>;
}
