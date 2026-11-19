import { router, usePathname, type Href } from 'expo-router';
import { RoleTabs, roleTabIcons } from '../shared/navigation/RoleTabs.ios';
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
      <RoleTabs hidden={pathname.startsWith('/ios-metalayzer/chat/') && !chatClosing} disableHiddenAnimation tabs={[
        { name: '(home)', label: 'Metalayzer', icon: { default: 'checkmark.circle', selected: 'checkmark.circle.fill' } },
        { name: 'profile', label: 'Profil', icon: roleTabIcons.profile },
        { name: 'chat', label: 'Chat', icon: roleTabIcons.chat, showBadge: unread > 0 },
      ]} />
    </RoleDrawer>
  </ChatClosingContext.Provider>;
}
