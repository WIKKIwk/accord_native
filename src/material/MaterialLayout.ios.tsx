import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { MaterialProvider } from './MaterialContext';
import { MaterialDrawer } from './MaterialDrawer';
import { useMaterialSession } from './useMaterialSession';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
export function MaterialLayout() {
  const { session, witness, onLogout } = useMaterialSession(), current = useSyncExternalStore(subscribe, locale, locale);
  if (Platform.OS !== 'ios' || session === null || (session && session.profile.role !== 'material_taminotchi')) return <Redirect href="/" />;
  if (!session || !witness) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!canOpenRoute(session, appRoutes.materialHome)) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', current)}</Text></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <MaterialProvider session={session} witness={witness} onLogout={onLogout}><MaterialDrawer><NativeTabs>
      <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{localizedGetter('homeNavTitle', current)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks" hidden={!canOpenRoute(session, appRoutes.materialTasks)}>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} />
        <NativeTabs.Trigger.Label>Vazifalar</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>{localizedGetter('profileTitle', current)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs></MaterialDrawer></MaterialProvider>
  </WorkerSecurityProvider>;
}
