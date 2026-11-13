import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RawSplitBusy } from '../homashyo/RawSplitBusy';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { useMetalayzerContext } from './MetalayzerContext';

export function MetalayzerDock({ active = 'home' }: { active?: 'home' | 'profile' | 'chat' }) {
  const { session, isCurrent } = useMetalayzerContext(), insets = useSafeAreaInsets(), unread = useChatUnreadCount(session);
  const items: RoleNavigationItem[] = [
    { id: 'home', label: 'Metalayzer', icon: 'check_circle' }, { id: 'profile', label: 'Profil', icon: 'person' },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble', showBadge: unread > 0 },
  ];
  return <RoleBottomBar active={active} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (!isCurrent()) return;
    if (id === 'home') router.navigate('/android-metalayzer' as Href);
    else if (id === 'profile') router.navigate('/android-metalayzer/profile' as Href);
    else if (id === 'chat') router.navigate('/android-metalayzer/chat' as Href);
  }} />;
}
export function MetalayzerFrame({ title, busy = false, profile = false, back = false, children }: { title: string; busy?: boolean; profile?: boolean; back?: boolean; children: ReactNode }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), drawer = useRoleDrawer();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <RoleHeader title={title} navigation={{ icon: profile || back ? 'back' : 'menu', label: profile || back ? 'Orqaga' : 'Bo‘limlar',
      onPress: profile ? () => router.navigate('/android-metalayzer' as Href) : back
        ? () => { if (router.canGoBack()) router.back(); else router.navigate('/android-metalayzer' as Href); } : drawer.open }} />
    {busy && <RawSplitBusy />}
    <View style={{ flex: 1 }}>{children}</View><MetalayzerDock active={profile ? 'profile' : 'home'} />
  </View>;
}
