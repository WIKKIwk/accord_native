import { router, useNavigation, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { localeController } from '../shared/localization/runtime';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { adminHomeShortcuts } from './adminHomeModel';
import { useAdminShell } from './AdminShellContext';

type PendingShortcut = typeof appRoutes.adminFactoryMap | typeof appRoutes.adminCalculateOrders | typeof appRoutes.adminCalculate;
export type AdminHomeShortcutRouteProps = { route: PendingShortcut };

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

export function useAdminHomeShortcutRoute(route: PendingShortcut) {
  const shell = useAdminShell();
  const navigation = useNavigation();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const shortcut = shell.destination(route, Platform.OS)
    ? adminHomeShortcuts(shell.session, locale).find(item => item.routeName === route)
    : undefined;

  const canInteract = () => navigation.isFocused() && !!shell.destination(route, Platform.OS);
  const goBack = () => {
    if (!canInteract()) return;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const home = shell.destination(appRoutes.adminHome, Platform.OS);
    if (home) router.replace(home as Href);
  };

  return { current: shell.isCurrent(), shortcut, backLabel: adminActivityBackLabel(locale), goBack, locale, canInteract };
}
