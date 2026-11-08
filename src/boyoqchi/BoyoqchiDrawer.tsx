import { isSessionWitnessCurrent } from '../auth';
import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useBoyoqchiContext } from './BoyoqchiContext';
import { useBoyoqchiGetter, useBoyoqchiText } from './useBoyoqchiText';
import { queueBoyoqchiDockNavigation } from './boyoqchiDockScheduler';
export function BoyoqchiDrawer({ children }: { children: ReactNode }) {
  const state = useRoleDrawerState(), { witness, onLogout, profileNavigation } = useBoyoqchiContext(), pathname = usePathname();
  const t = useBoyoqchiText(), getter = useBoyoqchiGetter();
  const base = Platform.OS === 'ios' ? '/ios-boyoqchi' : '/android-boyoqchi';
  const active = pathname.includes('/chat') ? 'chat' : pathname.endsWith('/profile') ? 'profile' : pathname.endsWith('/astatka') ? 'astatka' : 'home';
  const items = [
    { id: 'home', label: getter('homeNavTitle'), symbol: { ios: 'house' as const, android: 'home' as const } },
    { id: 'astatka', label: t('Astatka'), symbol: { ios: 'shippingbox' as const, android: 'inventory_2' as const } },
    { id: 'profile', label: getter('profileTitle'), symbol: { ios: 'person' as const, android: 'person' as const } },
  ];
  const select = (id: string) => {
    if (!isSessionWitnessCurrent(witness)) return;
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id !== 'home' && id !== 'astatka' && id !== 'profile') return;
    if (Platform.OS === 'android' && active === 'profile') {
      const registered = profileNavigation.current;
      if (registered) queueBoyoqchiDockNavigation({ destination: id, active: () => 'profile',
        isMounted: registered.isMounted, dispatch: registered.dispatch });
      return;
    }
    const target = id === 'home' ? base : `${base}/${id}`;
    if (active === 'home' || active === 'astatka') router.replace(target as Href);
    else router.navigate(target as Href);
  };
  return <RoleDrawer {...state} title={t('Bo‘yoqchi bo‘limlari')} items={items} active={active} onSelect={select}
    closeAccessibilityLabel={t('Menyuni yopish')}
    footerAction={{ id: 'logout', label: getter('logoutTitle'), destructive: true }}>
    {children}
  </RoleDrawer>;
}
