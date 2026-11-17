import { useSyncExternalStore } from 'react';
import { AdminHomeScreen } from '../admin/AdminHomeScreen';
import { useAdminRouteReturn } from '../admin/useAdminRouteReturn';
import { useAdminShell } from '../admin/AdminShellContext';
import { AdminShellProfileAction } from '../admin/AdminShellProfileAction';
import { useAdminShellNotice } from '../admin/AdminShellNoticeProvider';
import { BrigaderBottomBar } from './BrigaderBottomBar.ios';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { refreshHub } from '../shared/notificationStoresRuntime';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

/** @v2 AdminHomeScreen — Brigader reuses the same native page and shared controller. */
export function BrigaderHomeRoute() {
  const shell = useAdminShell(), drawer = useRoleDrawer(), openRoute = useAdminRouteReturn(), notice = useAdminShellNotice();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return <AdminHomeScreen session={shell.session} store={shell.store} hub={refreshHub} openRoute={openRoute}
    isRouteAvailable={shell.isRouteAvailable} isSessionCurrent={shell.isCurrent}
    navigation={{ icon: 'menu', label: localizedGetter('adminDrawerSections', locale), onPress: drawer.open }}
    profileAction={<AdminShellProfileAction />} topNotice={notice.topNotice} footer={<BrigaderBottomBar active="home" />} />;
}
