import { router, usePathname, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useBoyoqchiContext } from './BoyoqchiContext';
import { useBoyoqchiGetter, useBoyoqchiText } from './useBoyoqchiText';
export function BoyoqchiDrawer({ children }: { children: ReactNode }) {
  const state = useRoleDrawerState(), { onLogout } = useBoyoqchiContext(), pathname = usePathname();
  const t = useBoyoqchiText(), getter = useBoyoqchiGetter();
  const base = Platform.OS === 'ios' ? '/ios-boyoqchi' : '/android-boyoqchi';
  const active = pathname.includes('/chat') ? 'chat' : pathname.endsWith('/profile') ? 'profile' : pathname.endsWith('/astatka') ? 'astatka' : 'home';
  const items = [
    { id: 'home', label: getter('homeNavTitle'), symbol: { ios: 'house' as const, android: 'home' as const } },
    { id: 'astatka', label: t('Astatka'), symbol: { ios: 'shippingbox' as const, android: 'inventory_2' as const } },
    { id: 'chat', label: t('Chat'), symbol: { ios: 'bubble.left' as const, android: 'chat_bubble' as const } },
    { id: 'profile', label: getter('profileTitle'), symbol: { ios: 'person' as const, android: 'person' as const } },
  ];
  const select = (id: string) => {
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    const target = id === 'home' ? base : `${base}/${id}`;
    router.navigate(target as Href);
  };
  return <RoleDrawer {...state} title={t('Bo‘yoqchi bo‘limlari')} items={items} active={active} onSelect={select}
    closeAccessibilityLabel={t('Menyuni yopish')}
    footerAction={{ id: 'logout', label: getter('logoutTitle'), destructive: true }}>
    {children}
  </RoleDrawer>;
}
