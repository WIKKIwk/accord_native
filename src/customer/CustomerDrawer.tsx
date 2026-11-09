import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { uiText } from '../shared/localization';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useCustomerContext, useCustomerText } from './CustomerContext';
import { customerDestinationPath, customerDrawerActive, type CustomerDestination } from './customerNavigation';

/** @v2 CustomerNavigationDrawer; the shared native drawer owns open and close. */
export function CustomerDrawer({ children }: { children: ReactNode }) {
  const { onLogout } = useCustomerContext(), { text, locale } = useCustomerText();
  const state = useRoleDrawerState(), pathname = usePathname(), active = customerDrawerActive(pathname);
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const onSelect = (id: string) => {
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id !== 'home' && id !== 'notifications' && id !== 'profile') return;
    const target = customerDestinationPath(platform, id as CustomerDestination) as Href;
    // V2's drawer replaces only the current route, even if the target is in history.
    router.replace(target);
  };
  return <RoleDrawer {...state} title="Bo‘limlar" active={active} onSelect={onSelect}
    closeAccessibilityLabel={uiText('Menyuni yopish', locale)}
    items={[
      { id: 'home', label: text('homeNavTitle'), symbol: { ios: 'house', android: 'home', web: 'home' } },
      { id: 'notifications', label: text('notificationsShortTitle'), symbol: { ios: 'bell', android: 'notifications', web: 'notifications' } },
      { id: 'profile', label: text('profileTitle'), symbol: { ios: 'person', android: 'person', web: 'person' } },
    ]} footerAction={{ id: 'logout', label: text('logoutTitle'), symbol: 'rectangle.portrait.and.arrow.right', destructive: true }}>
    {children}
  </RoleDrawer>;
}
