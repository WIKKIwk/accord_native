import { router, useNavigation, useRoute, type Href } from 'expo-router';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Keyboard, Platform } from 'react-native';
import { appRoutes, canOpenRoute, homeRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { localeController } from '../shared/localization/runtime';
import { adminDockDestinations, adminDockSelection, type AdminDockTab } from './adminDockModel';
import { adminRootNavigation, type AdminRootNavigationContext } from './adminRootNavigation';
import { useAdminOwnedNavigation } from './AdminOwnedNavigationContext';
import { useAdminShell } from './AdminShellContext';

export type AdminOwnedDockProps = { active: AdminDockTab | null; isCurrent: () => boolean; canInteract: () => boolean };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener), getLocale = () => localeController.locale;
export function useAdminOwnedDock(props: AdminOwnedDockProps) {
  const shell = useAdminShell(), owned = useAdminOwnedNavigation(), navigation = useNavigation(), route = useRoute(), platform = Platform.OS;
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const { isCurrent, canInteract } = props;
  const [binding] = useState(() => ({ routeKey: route.key, navigatorKey: navigation.getState()?.key ?? '' }));
  const context = useMemo<AdminRootNavigationContext>(() => {
    const paths = () => { const state = navigation.getState(); return state?.routes.slice(0, state.index + 1).map(item => item.name === 'index' ? `/${platform}-admin` : `/${platform}-admin/${item.name}`) ?? []; };
    const current = () => { const state = navigation.getState(); return isSynchronouslyTrue(isCurrent) && isSynchronouslyTrue(canInteract) && owned.current() && owned.ready() &&
      state?.key === binding.navigatorKey && state.routes[state.index]?.key === binding.routeKey && isSynchronouslyTrue(isCurrent); };
    return { isCurrent: current, destination: name => name === appRoutes.adminSuppliers ? owned.ready() && canOpenRoute(shell.session, name) ? `/${platform}-admin/users` : null :
      name === appRoutes.adminActivity && !shell.activityBinding ? null : shell.destination(name, platform),
      currentPath: () => paths().at(-1) ?? null, containsPath: path => paths().includes(path), unfocus: () => Keyboard.dismiss(),
      popTo: path => { if (!current()) return; const name = path === `/${platform}-admin` ? 'index' : path.endsWith('/users') ? 'users' : path.endsWith('/activity') ? 'activity' : null;
        if (name) owned.owner.rootRemoval.dispatch(name, navigation, binding); },
      push: path => { if (current()) router.push(path as Href); } };
  }, [navigation, platform, isCurrent, canInteract, owned, binding, shell]);
  const destinations = adminDockDestinations(shell.session, locale).filter(item => !item.primary && !!context.destination(item.routeName));
  const select = (id: string) => {
    if (!context.isCurrent()) return; const destination = destinations.find(item => item.id === id); if (!destination) return;
    const home = homeRoute(shell.session);
    if (adminDockSelection(destination, props.active, context.currentPath() === context.destination(home) ? home : null, home) === 'replaceRoot') adminRootNavigation.schedule(destination.routeName, context);
  };
  return { destinations, select, active: destinations.find(item => item.tab === props.active)?.id ?? '' };
}
