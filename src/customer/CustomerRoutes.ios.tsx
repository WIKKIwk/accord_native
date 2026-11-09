import { Button, Host } from '@expo/ui/swift-ui';
import { labelStyle } from '@expo/ui/swift-ui/modifiers';
import { Redirect, Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { RoleDrawerButton } from '../shared/navigation/RoleDrawerButton';
import { useCustomerContext, useCustomerText } from './CustomerContext';
import { CustomerDeliveryDetailScreen } from './CustomerDelivery';
import { CustomerHomeScreen, CustomerStatusDetailScreen } from './CustomerHome';
import { CustomerNotificationsScreen } from './CustomerNotificationsView.ios';
import { customerStatusKind } from './customerNavigation';
import { customerStatusTitleKey } from './customerPresentation';
import { useCustomerNavigation } from './useCustomerNavigation';

export function CustomerHomeRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('ios');
  return <><Stack.Screen options={{ title: text('customerRoleName') }} />
    <CustomerHomeScreen onOpenStatus={navigation.openStatus} onOpenDetail={id => navigation.openDetail(id, 'home')} />
  </>;
}

export function CustomerStatusRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('ios');
  const { kind: value } = useLocalSearchParams<{ kind?: string }>(), kind = customerStatusKind(value);
  if (!kind) return <Redirect href={'/ios-customer' as Href} />;
  return <><Stack.Screen options={{ title: text(customerStatusTitleKey(kind)) }} />
    <CustomerStatusDetailScreen kind={kind} onOpenDetail={id => navigation.openDetail(id, 'status')} />
  </>;
}

export function CustomerDeliveryRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('ios');
  const { id, origin } = useLocalSearchParams<{ id?: string; origin?: string }>();
  if (!id) return <Redirect href={'/ios-customer' as Href} />;
  return <><Stack.Screen options={{ title: text('detailsTitle') }} />
    <CustomerDeliveryDetailScreen deliveryNoteID={id} onChanged={() => navigation.changed(origin)} />
  </>;
}

export function CustomerNotificationsRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('ios');
  const [clearAction, setClearAction] = useState<(() => void) | null>(null);
  const onClearActionChanged = useCallback((action: (() => void) | null) => { setClearAction(() => action); }, []);
  return <><Stack.Screen options={{ title: text('notificationsTitle'), headerRight: () => <Host matchContents>
    <Button label={text('clearTitle')} systemImage="line.3.horizontal.decrease.circle" modifiers={[labelStyle('iconOnly')]}
      onPress={() => clearAction?.()} /></Host> }} />
    <CustomerNotificationsScreen onOpenDetail={id => navigation.openDetail(id, 'notifications')} onClearActionChanged={onClearActionChanged} />
  </>;
}

export function CustomerProfileRoute() {
  const { session, onLogout } = useCustomerContext(), { text } = useCustomerText();
  return <><Stack.Screen options={{ title: text('profileTitle'), headerBackVisible: false,
    headerLeft: () => <RoleDrawerButton label={text('profileTitle')} /> }} />
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
      <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.navigate('/ios-customer' as Href)} />
    </SafeAreaView>
  </>;
}

/** Keep all Customer Chat entry points closed until the shared transport is reviewed. */
export function CustomerChatHold() { return <Redirect href={'/ios-customer' as Href} />; }
