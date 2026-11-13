import { router, usePathname, type Href } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { createContext, useContext, useState } from 'react';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { useMetalayzerContext } from './MetalayzerContext';

const ChatClosingContext = createContext<(value: boolean) => void>(() => {});
export const useMetalayzerChatClosing = () => useContext(ChatClosingContext);

export function MetalayzerIosShell() {
  const { session, onLogout, isCurrent } = useMetalayzerContext(), pathname = usePathname(), drawer = useRoleDrawerState();
  const unread = useChatUnreadCount(session), [chatClosing, setChatClosing] = useState(false);
  const navigate = (id: string) => {
    if (!isCurrent()) return;
    if (id === 'logout') { confirmRoleDrawerLogout(onLogout); return; }
    if (id === 'home') router.navigate('/ios-metalayzer' as Href);
    if (id === 'materials') router.navigate('/ios-metalayzer/materials' as Href);
    if (id === 'profile') router.navigate('/ios-metalayzer/profile' as Href);
  };
  return <ChatClosingContext.Provider value={setChatClosing}>
    <RoleDrawer {...drawer} title="Metalayzer" closeAccessibilityLabel="Yopish"
      items={[{ id: 'home', label: 'Metalayzer', symbol: 'checkmark.circle' },
        { id: 'materials', label: 'Metallangan xomashyolar', symbol: 'list.bullet' }, { id: 'profile', label: 'Profil', symbol: 'person' }]}
      active={pathname === '/ios-metalayzer' ? 'home' : pathname === '/ios-metalayzer/materials' ? 'materials' : pathname === '/ios-metalayzer/profile' ? 'profile' : ''}
      footerAction={{ id: 'logout', label: 'Chiqish', symbol: 'rectangle.portrait.and.arrow.right', destructive: true }} onSelect={navigate}>
      <NativeTabs hidden={pathname.startsWith('/ios-metalayzer/chat/') && !chatClosing} disableHiddenAnimation>
        <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'checkmark.circle', selected: 'checkmark.circle.fill' }} />
          <NativeTabs.Trigger.Label>Metalayzer</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="chat"><NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
          <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label><NativeTabs.Trigger.Badge hidden={unread <= 0}>{''}</NativeTabs.Trigger.Badge>
        </NativeTabs.Trigger>
      </NativeTabs>
    </RoleDrawer>
  </ChatClosingContext.Provider>;
}
