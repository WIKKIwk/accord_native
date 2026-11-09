import { router, usePathname, type Href } from 'expo-router';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { isSessionWitnessCurrent } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useMaterialContext } from './MaterialContext';
import { materialDrawerActive, materialDrawerItems, materialRoute } from './materialNavigation';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const locale = () => localeController.locale;
export function MaterialDrawer({ children }: { children: ReactNode }) {
  const { session, witness, onLogout } = useMaterialContext(), state = useRoleDrawerState(), path = usePathname();
  const current = useSyncExternalStore(subscribe, locale, locale);
  const items = materialDrawerItems(session, { home: localizedGetter('homeNavTitle', current), profile: localizedGetter('profileTitle', current) });
  const select = (id: string) => {
    if (!isSessionWitnessCurrent(witness)) return;
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id === 'tasks' && !canOpenRoute(session, appRoutes.materialTasks)) return;
    if (id === 'history' && !canOpenRoute(session, appRoutes.materialHistory)) return;
    const destination = materialRoute(id, Platform.OS === 'ios' ? 'ios' : 'android');
    if (!destination) return;
    if (id === 'history') router.push(destination as Href); else router.navigate(destination as Href);
  };
  return <RoleDrawer {...state} title="Material bo‘limlari" items={items} active={materialDrawerActive(path)} onSelect={select}
    closeAccessibilityLabel="Yopish" footerAction={{ id: 'logout', label: localizedGetter('logoutTitle', current),
      symbol: 'rectangle.portrait.and.arrow.right', destructive: true }}>{children}</RoleDrawer>;
}
