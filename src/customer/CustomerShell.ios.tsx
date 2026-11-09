import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { CustomerDrawer } from './CustomerDrawer';
import { useCustomerText, useCustomerUnread } from './CustomerContext';
import { customerNotificationBadge } from './customerNavigation';

export function CustomerShell() {
  const { text } = useCustomerText(), pathname = usePathname(), unread = useCustomerUnread();
  const notificationActive = pathname === '/ios-customer/notifications';
  return <CustomerDrawer>
    <NativeTabs>
      <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{text('homeNavTitle')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications"><NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
        <NativeTabs.Trigger.Label>{text('notificationsShortTitle')}</NativeTabs.Trigger.Label>
        {customerNotificationBadge(unread, notificationActive ? 'notifications' : null) ? <NativeTabs.Trigger.Badge /> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat" hidden><NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    </NativeTabs>
  </CustomerDrawer>;
}
