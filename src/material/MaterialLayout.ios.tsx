import { Redirect, usePathname } from 'expo-router';
import { RoleTabs, roleTabIcons } from '../shared/navigation/RoleTabs.ios';
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
  return <RoleTabs hidden={pathname.startsWith('/ios-material/chat/') && !chatClosing} disableHiddenAnimation tabs={[
    { name: '(home)', label: localizedGetter('homeNavTitle', current), icon: roleTabIcons.home },
    { name: 'receipt', label: 'Kirim', icon: { default: 'scalemass', selected: 'scalemass.fill' }, hidden: !canOpenRoute(session, appRoutes.gscaleMode) },
    { name: 'tasks', label: 'Vazifalar', icon: 'checklist', hidden: !canOpenRoute(session, appRoutes.materialTasks) },
    { name: 'profile', label: localizedGetter('profileTitle', current), icon: roleTabIcons.profile },
    { name: 'chat', label: 'Chat', icon: roleTabIcons.chat, showBadge: unread > 0 },
  ]} />;
}
