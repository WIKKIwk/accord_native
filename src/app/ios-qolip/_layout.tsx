import { NativeTabs } from 'expo-router/native-tabs';
import { usePathname } from 'expo-router';
import { QolipSessionGate } from '../../qolip/QolipSessionGate';
import { useQolipRole } from '../../qolip/QolipRoleContext';
import { useQolipText } from '../../qolip/useQolipText';
import { useChatUnreadCount } from '../../shared/chat/useChatUnreadCount';
import { localizedGetter } from '../../shared/localization';
export default function Layout() { return <QolipSessionGate platform="ios"><Tabs /></QolipSessionGate>; }
function Tabs() {
 const { text, locale } = useQolipText(), { session } = useQolipRole(), unread = useChatUnreadCount(session), path = usePathname();
 return <NativeTabs hidden={path.startsWith('/ios-qolip/chat/')} disableHiddenAnimation>
  <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} /><NativeTabs.Trigger.Label>{localizedGetter('homeNavTitle', locale)}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="(products)"><NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} /><NativeTabs.Trigger.Label>{text('nav.molds')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="(tasks)"><NativeTabs.Trigger.Icon sf="checklist" /><NativeTabs.Trigger.Label>{text('nav.tasks')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="chat"><NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} /><NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label><NativeTabs.Trigger.Badge hidden={unread <= 0}>{''}</NativeTabs.Trigger.Badge></NativeTabs.Trigger>
 </NativeTabs>;
}
