import { Redirect, router, useIsFocused, type Href } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { AdditionalSettingsRoute } from './AdditionalSettingsRoute';
import { AdminSettingsScreen } from './AdminSettingsScreen';
import { ItemGroupsRoute } from './ItemGroupsRoute';
import { adminActivityBackLabel } from './adminActivityBackLabel';
import { useAdminShell } from './AdminShellContext';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

/** Keep the original shell authority; focus only gates navigation, never background reads. */
function useManagementRoute(route: string) {
  const shell = useAdminShell(), drawer = useRoleDrawer(), focused = useIsFocused();
  const mounted = useRef(false), focus = useRef(focused);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { focus.current = focused; return () => { focus.current = false; }; }, [focused]);
  const mayNavigate = useCallback(() => mounted.current && focus.current && shell.isCurrent() &&
    !!shell.destination(route, Platform.OS), [shell, route]);
  const canGoBack = router.canGoBack();
  const navigation = useMemo(() => ({ icon: canGoBack ? 'back' as const : 'menu' as const,
    label: canGoBack ? adminActivityBackLabel(locale) : localizedGetter('adminDrawerSections', locale),
    onPress: () => {
      if (!mayNavigate()) return;
      if (canGoBack) { if (router.canGoBack()) router.back(); }
      else drawer.open();
    } }), [canGoBack, locale, mayNavigate, drawer]);
  const navigate = useCallback((next: string) => {
    if (!mayNavigate()) return;
    const path = shell.destination(next, Platform.OS);
    if (path) router.push(path as Href);
  }, [mayNavigate, shell]);
  return { shell, navigation, navigate, admitted: !!shell.destination(route, Platform.OS) };
}

export function AdminAdditionalSettingsRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, admitted } = useManagementRoute(appRoutes.adminAdditionalSettings);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <AdditionalSettingsRoute session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} footer={footer} />;
}

export function AdminSettingsRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, navigate, admitted } = useManagementRoute(appRoutes.adminSettings);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  // Home already reloads on return; no caller currently consumes the V2 changed result.
  return <AdminSettingsScreen session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} onNavigate={navigate} isRouteAvailable={shell.isRouteAvailable} footer={footer} />;
}

export function AdminItemGroupsRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, admitted } = useManagementRoute(appRoutes.adminItemGroupCreate);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <ItemGroupsRoute session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} footer={footer} />;
}
