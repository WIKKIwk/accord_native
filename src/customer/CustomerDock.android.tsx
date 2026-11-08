import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useCustomerContext, useCustomerText, useCustomerUnread } from './CustomerContext';
import { customerDestinationPath, customerNotificationBadge, type CustomerDestination } from './customerNavigation';

/** @v2 CustomerDock plus RoleDock's shared Chat destination. */
export function CustomerDock({ active }: { active: 'home' | 'notifications' | 'chat' | null }) {
  const { text } = useCustomerText(), unread = useCustomerUnread(), { chatUnread } = useCustomerContext(), insets = useSafeAreaInsets();
  const items: RoleNavigationItem[] = [
    { id: 'home', label: text('homeNavTitle'), icon: 'home', testID: 'customer-home' },
    { id: 'notifications', label: text('notificationsShortTitle'), icon: 'notifications', testID: 'customer-notifications',
      showBadge: customerNotificationBadge(unread, active) },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble', testID: 'customer-chat', showBadge: chatUnread > 0 },
  ];
  return <RoleBottomBar active={active ?? ''} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === active || (id !== 'home' && id !== 'notifications' && id !== 'chat')) return;
    router.dismissTo(customerDestinationPath('android', id as CustomerDestination) as Href);
  }} />;
}
