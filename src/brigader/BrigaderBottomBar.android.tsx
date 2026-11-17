import { BrigaderPrimaryAction } from './BrigaderPrimaryAction';
import { router, useIsFocused, useNavigation, type Href } from 'expo-router';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appRoutes, homeRoute } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useAdminShell } from '../admin/AdminShellContext';
import { adminDockDestinations, adminDockSelection, type AdminDockTab } from '../admin/adminDockModel';
import { adminRootNavigation, type AdminRootNavigationContext } from '../admin/adminRootNavigation';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

/** Reuse V2's Admin dock policy and the existing native Material navigation bar. */
export function BrigaderBottomBar({ active, primary = true }: { active: AdminDockTab | null; primary?: boolean }) {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), insets = useSafeAreaInsets();
  const navigation = useNavigation(), focused = useIsFocused(), focus = useRef(focused), mounted = useRef(false);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const context = useMemo<AdminRootNavigationContext>(() => {
    const paths = () => {
      const state = navigation.getState();
      return state?.routes.slice(0, state.index + 1).map(route => route.name === 'index' ? '/android-brigader' : `/android-brigader/${route.name}`) ?? [];
    };
    return { isCurrent: () => mounted.current && focus.current && shell.isCurrent(),
      destination: route => route === appRoutes.adminActivity && !shell.activityBinding ? null : shell.destination(route, 'android'),
      currentPath: () => paths().at(-1) ?? null, containsPath: path => paths().includes(path), unfocus: () => Keyboard.dismiss(),
      popTo: path => router.dismissTo(path as Href), push: path => router.push(path as Href) };
  }, [navigation, shell]);
  const destinations = adminDockDestinations(shell.session, locale).filter(item => !item.primary &&
    !!shell.destination(item.routeName, 'android') && (item.routeName !== appRoutes.adminActivity || !!shell.activityBinding));
  const items: RoleNavigationItem[] = destinations.map(item => ({ id: item.id, label: item.label,
    icon: item.tab === 'home' ? 'home' : item.tab === 'user' ? 'person' : 'history' }));
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
  return <>{primary ? <BrigaderPrimaryAction isCurrent={context.isCurrent} canInteract={context.isCurrent} /> : null}<RoleBottomBar active={destinations.find(item => item.tab === active)?.id ?? ''} items={items} onSelect={select} bottomInset={insets.bottom} /></>;
}
