import { router, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appRoutes } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useAdminShell } from './AdminShellContext';
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
export function AdminBottomBar({ active }: { active: 'home' | 'activity' }) {
  const shell = useAdminShell(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), insets = useSafeAreaInsets();
  const activityPath = shell.activityBinding ? shell.destination(appRoutes.adminActivity, 'android') : null;
  const items: RoleNavigationItem[] = [{ id: 'home', label: localizedGetter('adminHomeNavTitle', locale), icon: 'home' }];
  if (activityPath) items.push({ id: 'activity', label: localizedGetter('adminActivityNavTitle', locale), icon: 'history' });
  const select = (id: string) => {
    if (id === active || !shell.isCurrent()) return;
    if (id === 'home') router.replace('/android-admin' as Href);
    else if (id === 'activity') { const path = shell.destination(appRoutes.adminActivity, 'android'); if (path && shell.activityBinding) router.replace(path as Href); }
  };
  return <RoleBottomBar active={active} items={items} onSelect={select} bottomInset={insets.bottom} />;
}
