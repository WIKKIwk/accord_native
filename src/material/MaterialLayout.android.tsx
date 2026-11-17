import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { MaterialBottomBar } from './MaterialBottomBar.android';
import { MaterialProvider } from './MaterialContext';
import { MaterialDrawer } from './MaterialDrawer';
import { useMaterialSession } from './useMaterialSession';
import { isMaterialTestSession } from './materialTestSession';
import { MaterialTestNotice } from './MaterialTestNotice';
import { materialPathAllowed } from './materialRouteAccess';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
export function MaterialLayout() {
  const { session, witness, onLogout } = useMaterialSession(), path = usePathname(), current = useSyncExternalStore(subscribe, locale, locale);
  const colors = useMaterialColors();
  if (Platform.OS !== 'android' || session === null || (session && session.profile.role !== 'material_taminotchi')) return <Redirect href="/" />;
  if (!session || !witness) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (isMaterialTestSession(session)) return <MaterialTestNotice />;
  if (!canOpenRoute(session, appRoutes.materialHome) || !materialPathAllowed(session, path)) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', current)}</Text></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <MaterialProvider session={session} witness={witness} onLogout={onLogout}><MaterialDrawer><View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow }}>
      <Stack screenOptions={{ headerShown: false }} />
      <MaterialBottomBar />
    </View></MaterialDrawer></MaterialProvider>
  </WorkerSecurityProvider>;
}
