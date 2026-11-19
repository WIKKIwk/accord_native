import { router, useIsFocused, useNavigation, type Href } from 'expo-router';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appRoutes, homeRoute } from '../shared/appRoutes';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { localeController } from '../shared/localization/runtime';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { useAdminShell } from './AdminShellContext';
import { adminAndroidDockItems, adminDockChatDestination, adminDockDestinations, adminDockSelection, type AdminDockTab } from './adminDockModel';
import { adminRootNavigation, type AdminRootNavigationContext } from './adminRootNavigation';
import { useAdminShellLayout } from './useAdminShellLayout';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminBottomBar({ active }: { active: AdminDockTab | null }) {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), insets = useSafeAreaInsets();
  const layout = useAdminShellLayout(true), unread = useChatUnreadCount(shell.session);
  const navigation = useNavigation('/android-admin'), focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const context = useMemo<AdminRootNavigationContext>(() => {
    const paths = () => {
      const state = navigation.getState();
      return state?.routes.slice(0, state.index + 1).map(route => route.name === 'index' ? '/android-admin' : `/android-admin/${route.name}`) ?? [];
    };
    return { isCurrent: () => mounted.current && focus.current && shell.isCurrent(),
      destination: route => route === appRoutes.adminActivity && !shell.activityBinding ? null : shell.destination(route, 'android'),
      currentPath: () => paths().at(-1) ?? null, containsPath: path => paths().includes(path), unfocus: () => Keyboard.dismiss(),
      popTo: path => router.dismissTo(path as Href), push: path => router.push(path as Href) };
  }, [navigation, shell]);
  const destinations = [...adminDockDestinations(shell.session, locale), adminDockChatDestination].filter(item => !item.primary &&
    !!shell.destination(item.routeName, 'android') && (item.routeName !== appRoutes.adminActivity || !!shell.activityBinding));
  const select = (id: string) => {
    if (!mounted.current || !focus.current || !shell.isCurrent()) return;
    const destination = destinations.find(item => item.id === id);
    if (!destination) return;
    const path = shell.destination(destination.routeName, 'android');
    const home = homeRoute(shell.session), homePath = shell.destination(home, 'android');
    if (!path || (destination.routeName === appRoutes.adminActivity && !shell.activityBinding) ||
      adminDockSelection(destination, active, context.currentPath() === homePath ? home : null, home) !== 'replaceRoot') return;
    adminRootNavigation.schedule(destination.routeName, context);
  };
  return <RoleBottomBar compact active={destinations.find(item => item.tab === active)?.id ?? ''}
    items={adminAndroidDockItems(destinations, unread > 0)} onSelect={select} bottomInset={layout.dockBottomInset ?? insets.bottom} />;
}
