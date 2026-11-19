import { usePathname } from 'expo-router';
import { RoleTabs, roleTabIcons } from '../shared/navigation/RoleTabs.ios';
import { CustomerDrawer } from './CustomerDrawer';
import { useCustomerText, useCustomerUnread } from './CustomerContext';
import { customerNotificationBadge } from './customerNavigation';

export function CustomerShell() {
  const { text } = useCustomerText(), pathname = usePathname(), unread = useCustomerUnread();
  const notificationActive = pathname === '/ios-customer/notifications';
  return <CustomerDrawer>
    <RoleTabs tabs={[
      { name: '(home)', label: text('homeNavTitle'), icon: roleTabIcons.home },
      { name: 'notifications', label: text('notificationsShortTitle'), icon: { default: 'bell', selected: 'bell.fill' },
        showBadge: customerNotificationBadge(unread, notificationActive ? 'notifications' : null) },
      { name: 'chat', label: 'Chat', icon: roleTabIcons.chat, hidden: true },
    ]} />
  </CustomerDrawer>;
}
