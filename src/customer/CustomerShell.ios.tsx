import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { createContext, useContext, useState } from 'react';
import { CustomerDrawer } from './CustomerDrawer';
import { useCustomerContext, useCustomerText, useCustomerUnread } from './CustomerContext';
import { customerNotificationBadge } from './customerNavigation';

const ChatClosingContext = createContext<(closing: boolean) => void>(() => {});
export const useCustomerChatClosing = () => useContext(ChatClosingContext);

export function CustomerShell() {
  const { text } = useCustomerText(), { chatUnread } = useCustomerContext(), pathname = usePathname(), unread = useCustomerUnread();
  const [chatClosing, setChatClosing] = useState(false);
  const notificationActive = pathname === '/ios-customer/notifications';
  return <ChatClosingContext.Provider value={setChatClosing}><CustomerDrawer>
    <NativeTabs hidden={pathname.startsWith('/ios-customer/chat/') && !chatClosing} disableHiddenAnimation>
      <NativeTabs.Trigger name="(home)"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>{text('homeNavTitle')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications"><NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} />
        <NativeTabs.Trigger.Label>{text('notificationsShortTitle')}</NativeTabs.Trigger.Label>
        {customerNotificationBadge(unread, notificationActive ? 'notifications' : null) ? <NativeTabs.Trigger.Badge /> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat"><NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        {chatUnread > 0 ? <NativeTabs.Trigger.Badge /> : null}</NativeTabs.Trigger>
    </NativeTabs>
  </CustomerDrawer></ChatClosingContext.Provider>;
}
