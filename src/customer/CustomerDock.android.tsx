import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useCustomerContext, useCustomerText, useCustomerUnread } from './CustomerContext';
import { customerNotificationBadge } from './customerNavigation';

/** @v2 CustomerDock plus RoleDock's shared Chat destination. */
export function CustomerDock({ active }: { active: 'home' | 'notifications' | 'chat' | null }) {
  const { text } = useCustomerText(), unread = useCustomerUnread(), { chatUnread } = useCustomerContext(), insets = useSafeAreaInsets();
  const navigation = useNavigation('/android-customer');
  const items: RoleNavigationItem[] = [
    { id: 'home', label: text('homeNavTitle'), icon: 'home', testID: 'customer-home' },
    { id: 'notifications', label: text('notificationsShortTitle'), icon: 'notifications', testID: 'customer-notifications',
      showBadge: customerNotificationBadge(unread, active) },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble', testID: 'customer-chat', showBadge: chatUnread > 0 },
  ];
  return <RoleBottomBar active={active ?? ''} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === active || (id !== 'home' && id !== 'notifications' && id !== 'chat')) return;
    // V2 pops to an existing root destination but pushes when it is absent.
    // StackRouter's NAVIGATE(pop) has those semantics; POP_TO replaces when absent.
    navigation.dispatch({ type: 'NAVIGATE', payload: { name: id === 'home' ? 'index' : id, pop: true } });
  }} />;
}
