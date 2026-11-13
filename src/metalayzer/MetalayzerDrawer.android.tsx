import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useMetalayzerContext } from './MetalayzerContext';

export function MetalayzerDrawer({ children }: { children: ReactNode }) {
  const state = useRoleDrawerState(), pathname = usePathname(), { onLogout, isCurrent } = useMetalayzerContext();
  const active = pathname.endsWith('/profile') ? 'profile' : pathname.includes('/chat') ? 'chat' : 'home';
  return <RoleDrawer {...state} title="Metalayzer" active={active} closeAccessibilityLabel="Yopish"
    items={[{ id: 'home', label: 'Metalayzer', symbol: { android: 'check_circle' } }, { id: 'profile', label: 'Profil', symbol: { android: 'person' } }]}
    footerAction={{ id: 'logout', label: 'Chiqish', destructive: true, symbol: { android: 'logout' } }}
    onSelect={id => { if (!isCurrent()) return; if (id === 'logout') confirmRoleDrawerLogout(onLogout);
      else if (id === 'home') router.navigate('/android-metalayzer' as Href);
      else if (id === 'profile') router.navigate('/android-metalayzer/profile' as Href); }}>{children}</RoleDrawer>;
}
