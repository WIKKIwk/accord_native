import { Redirect, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { WorkerSecurityProvider } from '../components/WorkerSecurity';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { MaterialProvider, useMaterialContext } from './MaterialContext';
import { MaterialDrawer } from './MaterialDrawer';
import { useMaterialSession } from './useMaterialSession';
import { isMaterialTestSession } from './materialTestSession';
import { MaterialTestNotice } from './MaterialTestNotice';
import { materialPathAllowed } from './materialRouteAccess';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
export function MaterialLayout() {
  const { session, witness, onLogout } = useMaterialSession(), current = useSyncExternalStore(subscribe, locale, locale);
  const pathname = usePathname();
  if (Platform.OS !== 'ios' || session === null || (session && session.profile.role !== 'material_taminotchi')) return <Redirect href="/" />;
  if (!session || !witness) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (isMaterialTestSession(session)) return <MaterialTestNotice />;
  if (!canOpenRoute(session, appRoutes.materialHome) || !materialPathAllowed(session, pathname)) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text>{localizedGetter('accessDenied', current)}</Text></View>;
  return <WorkerSecurityProvider key={session.imageCacheScope} session={session} onLogout={onLogout}>
    <MaterialProvider key={session.imageCacheScope} session={session} witness={witness} onLogout={onLogout}><MaterialDrawer><MaterialTabs current={current} />
    </MaterialDrawer></MaterialProvider>
  </WorkerSecurityProvider>;
}

/** @v2 MaterialTaminotchiDock */
function MaterialTabs({ current }: { current: string }) {
  const { session, unread, chatClosing } = useMaterialContext(), pathname = usePathname();
  return <NativeTabs hidden={pathname.startsWith('/ios-material/chat/') && !chatClosing} disableHiddenAnimation>
      <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{localizedGetter('homeNavTitle', current)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="receipt" hidden={!canOpenRoute(session, appRoutes.gscaleMode)}>
        <NativeTabs.Trigger.Icon sf={{ default: 'scalemass', selected: 'scalemass.fill' }} />
        <NativeTabs.Trigger.Label>Kirim</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="tasks" hidden={!canOpenRoute(session, appRoutes.materialTasks)}>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist' }} />
        <NativeTabs.Trigger.Label>Vazifalar</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>{localizedGetter('profileTitle', current)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat"><NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={unread <= 0}>{''}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    </NativeTabs>;
}
