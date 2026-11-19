import { RoleTabs, roleTabIcons } from '../../shared/navigation/RoleTabs.ios';
import { usePathname } from 'expo-router';
import { QolipSessionGate } from '../../qolip/QolipSessionGate';
import { useQolipRole } from '../../qolip/QolipRoleContext';
import { useQolipText } from '../../qolip/useQolipText';
import { useChatUnreadCount } from '../../shared/chat/useChatUnreadCount';
import { localizedGetter } from '../../shared/localization';
export default function Layout() { return <QolipSessionGate platform="ios"><Tabs /></QolipSessionGate>; }
function Tabs() {
 const { text, locale } = useQolipText(), { session } = useQolipRole(), unread = useChatUnreadCount(session), path = usePathname();
 return <RoleTabs hidden={path.startsWith('/ios-qolip/chat/')} disableHiddenAnimation tabs={[
    { name: '(home)', label: localizedGetter('homeNavTitle', locale), icon: roleTabIcons.home },
    { name: '(products)', label: text('nav.molds'), icon: { default: 'shippingbox', selected: 'shippingbox.fill' } },
    { name: '(tasks)', label: text('nav.tasks'), icon: 'checklist' },
    { name: 'chat', label: 'Chat', icon: roleTabIcons.chat, showBadge: unread > 0 },
  ]} />;
}
