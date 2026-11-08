import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleBottomBar, type RoleNavigationItem } from '../shared/navigation/RoleBottomBar.android';
import { useCustomerText, useCustomerUnread } from './CustomerContext';
import { customerNotificationBadge } from './customerNavigation';
import { queueCustomerDockNavigation } from './customerDockScheduler';

/** @v2 CustomerDock plus RoleDock's shared Chat destination. */
export function CustomerDock({ active }: { active: 'home' | 'notifications' | 'chat' | null }) {
  const { text } = useCustomerText(), unread = useCustomerUnread(), insets = useSafeAreaInsets();
  const navigation = useNavigation('/android-customer');
  const mounted = useRef(true), current = useRef(active);
  useEffect(() => { current.current = active; }, [active]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const items: RoleNavigationItem[] = [
    { id: 'home', label: text('homeNavTitle'), icon: 'home', testID: 'customer-home' },
    { id: 'notifications', label: text('notificationsShortTitle'), icon: 'notifications', testID: 'customer-notifications',
      showBadge: customerNotificationBadge(unread, active) },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble', testID: 'customer-chat' },
  ];
  return <RoleBottomBar active={active ?? ''} items={items} bottomInset={insets.bottom} onSelect={id => {
    if (id === active || (id !== 'home' && id !== 'notifications' && id !== 'chat')) return;
    // V2 coalesces taps and pops to an existing destination or pushes an absent one.
    queueCustomerDockNavigation({ destination: id, active: () => current.current, isMounted: () => mounted.current,
      dispatch: action => navigation.dispatch(action) });
  }} />;
}
