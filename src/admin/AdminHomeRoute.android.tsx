import { useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleBottomBar } from '../shared/navigation/RoleBottomBar.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { refreshHub } from '../shared/notificationStoresRuntime';
import { AdminHomeScreen } from './AdminHomeScreen';
import { useAdminShell } from './AdminShellContext';
import { useAdminRouteReturn } from './useAdminRouteReturn';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminHomeRoute() {
  const shell = useAdminShell(), drawer = useRoleDrawer(), openRoute = useAdminRouteReturn(), insets = useSafeAreaInsets();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  return <AdminHomeScreen session={shell.session} store={shell.store} hub={refreshHub} openRoute={openRoute}
    isRouteAvailable={shell.isRouteAvailable} navigation={{ icon: 'menu', label: localizedGetter('adminDrawerSections', locale), onPress: drawer.open }}
    footer={<RoleBottomBar active="admin-home" items={[{ id: 'admin-home', label: localizedGetter('adminHomeNavTitle', locale), icon: 'home' }]}
      onSelect={() => {}} bottomInset={insets.bottom} />} />;
}
