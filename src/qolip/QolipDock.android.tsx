import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useChatUnreadCount } from '../shared/chat/useChatUnreadCount';
import { localizedGetter } from '../shared/localization';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
export function QolipDock() {
  const role = useQolipRole(), { text, locale } = useQolipText(), insets = useSafeAreaInsets(), pathname = usePathname();
  const unread = useChatUnreadCount(role.session), leaf = pathname.slice('/android-qolip'.length + 1).split('/')[0] || 'home';
  const items: RoleNavigationItem[] = [{ id: 'home', label: localizedGetter('homeNavTitle', locale), icon: 'home' },
    { id: 'products', label: text('nav.molds'), icon: 'inventory_2' }, { id: 'tasks', label: text('nav.tasks'), icon: 'task_alt' },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble', showBadge: unread > 0 }];
  return <RoleBottomBar active={leaf} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (!role.isCurrent() || id === leaf) return;
    if (id === 'home') router.dismissTo('/android-qolip' as Href); else router.replace(('/android-qolip/' + id) as Href);
  }} />;
}
