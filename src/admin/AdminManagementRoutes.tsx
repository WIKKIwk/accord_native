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
import { AdminShellProfileAction } from './AdminShellProfileAction';
import { AdminInactiveSuppliersScreen } from './AdminInactiveSuppliersScreen';
import { useAdminShellNotice } from './AdminShellNoticeProvider';
import { AdminQueuePolicyScreen } from './AdminQueuePolicyScreen';
import { AdminRolesScreen } from './AdminRolesScreen';
import type { AdminTopNoticeIcon } from './adminTopNoticeModel';
import type { AdminRolesNotice } from './adminRolesController';

const roleNoticeIcons: Readonly<Record<AdminRolesNotice['icon'], AdminTopNoticeIcon>> = Object.freeze({
  verified_user: { androidSymbol: 'verified_user', iosSystemName: 'checkmark.shield.fill' },
  assignment_turned_in_outlined: { androidSymbol: 'assignment_turned_in', iosSystemName: 'checkmark.rectangle' },
  error: { androidSymbol: 'error', iosSystemName: 'exclamationmark.circle.fill' },
  error_outline: { androidSymbol: 'error_outline', iosSystemName: 'exclamationmark.circle' },
});

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

/** Keep the original shell authority; focus only gates navigation, never background reads. */
function useManagementRoute(route: string) {
  const shell = useAdminShell(), drawer = useRoleDrawer(), focused = useIsFocused(), notice = useAdminShellNotice();
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
  return { shell, navigation, navigate, notice, admitted: !!shell.destination(route, Platform.OS) };
}

export function AdminAdditionalSettingsRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, notice, admitted } = useManagementRoute(appRoutes.adminAdditionalSettings);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <AdditionalSettingsRoute session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} topNotice={notice.topNotice} footer={footer} />;
}

export function AdminSettingsRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, navigate, notice, admitted } = useManagementRoute(appRoutes.adminSettings);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  // Home already reloads on return; no caller currently consumes the V2 changed result.
  return <AdminSettingsScreen session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} onNavigate={navigate} isRouteAvailable={shell.isRouteAvailable} profileAction={<AdminShellProfileAction />} topNotice={notice.topNotice} footer={footer} />;
}

export function AdminInactiveSuppliersRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, notice, admitted } = useManagementRoute(appRoutes.adminInactiveSuppliers);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <AdminInactiveSuppliersScreen session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} profileAction={<AdminShellProfileAction />} topNotice={notice.topNotice} footer={footer} />;
}

export function AdminQueuePoliciesRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, notice, admitted } = useManagementRoute(appRoutes.adminQueuePolicies);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <AdminQueuePolicyScreen session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} profileAction={<AdminShellProfileAction />} footer={footer} topNotice={notice.topNotice} onErrorNotice={notice.onErrorNotice} />;
}

export function AdminRolesRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, notice, admitted } = useManagementRoute(appRoutes.adminRoles);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <AdminRolesScreen session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} profileAction={<AdminShellProfileAction />} footer={footer} topNotice={notice.topNotice}
    showTopNotice={(message, tone, icon) => notice.showTopNotice(message, tone, roleNoticeIcons[icon])} />;
}

export function AdminItemGroupsRoute({ footer }: { footer?: ReactNode }) {
  const { shell, navigation, notice, admitted } = useManagementRoute(appRoutes.adminItemGroupCreate);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!admitted) return <Redirect href="/" />;
  return <ItemGroupsRoute session={shell.session} witness={shell.witness} isCurrent={shell.isCurrent}
    navigation={navigation} topNotice={notice.topNotice} showTopNotice={notice.showTopNotice} footer={footer} />;
}
