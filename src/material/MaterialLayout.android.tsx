import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Redirect, Stack, router, usePathname, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { MaterialProvider } from './MaterialContext';
import { MaterialDrawer } from './MaterialDrawer';
import { useMaterialSession } from './useMaterialSession';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
export function MaterialLayout() {
  const { session, onLogout } = useMaterialSession(), path = usePathname(), current = useSyncExternalStore(subscribe, locale, locale);
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  if (Platform.OS !== 'android' || session === null || (session && session.profile.role !== 'material_taminotchi')) return <Redirect href="/" />;
  if (!session) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!canOpenRoute(session, appRoutes.materialHome)) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', current)}</Text></View>;
  const active = path.endsWith('/profile') ? 'profile' : path.endsWith('/tasks') ? 'tasks' : 'home';
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <MaterialProvider session={session} onLogout={onLogout}><MaterialDrawer><View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow }}>
      <Stack screenOptions={{ headerShown: false }} />
      <RoleBottomBar active={active} bottomInset={insets.bottom} items={[
        { id: 'home', label: localizedGetter('homeNavTitle', current), icon: 'home' },
        ...(canOpenRoute(session, appRoutes.materialTasks) ? [{ id: 'tasks', label: 'Vazifalar', icon: 'assignment' as const }] : []),
        { id: 'profile', label: localizedGetter('profileTitle', current), icon: 'person' },
      ]} onSelect={id => { if (id === 'home') router.navigate('/android-material' as Href);
        else if (id === 'tasks' && canOpenRoute(session, appRoutes.materialTasks)) router.navigate('/android-material/tasks' as Href);
        else if (id === 'profile') router.navigate('/android-material/profile' as Href); }} />
    </View></MaterialDrawer></MaterialProvider>
  </WorkerSecurityProvider>;
}
