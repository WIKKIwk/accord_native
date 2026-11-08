import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { uiText } from '../shared/localization';
import { ChatListPage, ChatRouteStack } from '../shared/chat/ChatPages';
import { ChatRouteProvider } from '../shared/chat/ChatRouteContext';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { useCustomerContext, useCustomerText } from './CustomerContext';
import { CustomerDeliveryDetailScreen } from './CustomerDelivery';
import { CustomerDock } from './CustomerDock.android';
import { CustomerHomeScreen, CustomerStatusDetailScreen } from './CustomerHome';
import { CustomerNotificationsScreen } from './CustomerNotifications.android';
import { customerStatusKind } from './customerNavigation';
import { customerStatusTitleKey } from './customerPresentation';
import { useCustomerNavigation } from './useCustomerNavigation';

function CustomerPage({ title, active, root, clearAction, children }: { title: string; active: 'home' | 'notifications' | null;
  root?: boolean; clearAction?: () => void; children: ReactNode }) {
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), drawer = useRoleDrawer(), { locale, text } = useCustomerText();
  const navigation = root ? { icon: 'menu' as const, label: uiText('Menyu', locale), onPress: drawer.open }
    : { icon: 'back' as const, label: uiText('Orqaga', locale), onPress: () => {
      if (router.canGoBack()) router.back(); else router.replace('/android-customer' as Href);
    } };
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><RoleHeader title={title} navigation={navigation} /></View>
      {clearAction ? <Pressable accessibilityRole="button" accessibilityLabel={text('clearTitle')} onPress={clearAction}
        style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16,
          backgroundColor: colors.secondaryContainer }}><SymbolView name={{ android: 'clear_all' }} size={24} tintColor={colors.onSecondaryContainer} /></Pressable> : null}
    </View><View style={{ flex: 1 }}>{children}</View><CustomerDock active={active} />
  </View>;
}

export function CustomerHomeRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('android');
  return <CustomerPage title={text('customerRoleName')} active="home" root>
    <CustomerHomeScreen onOpenStatus={navigation.openStatus} onOpenDetail={id => navigation.openDetail(id, 'home')} />
  </CustomerPage>;
}

export function CustomerStatusRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('android');
  const { kind: value } = useLocalSearchParams<{ kind?: string }>(), kind = customerStatusKind(value);
  if (!kind) return <Redirect href={'/android-customer' as Href} />;
  return <CustomerPage title={text(customerStatusTitleKey(kind))} active={null}>
    <CustomerStatusDetailScreen kind={kind} onOpenDetail={id => navigation.openDetail(id, 'status')} />
  </CustomerPage>;
}

export function CustomerDeliveryRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('android');
  const { id, origin } = useLocalSearchParams<{ id?: string; origin?: string }>();
  if (!id) return <Redirect href={'/android-customer' as Href} />;
  return <CustomerPage title={text('detailsTitle')} active={null}>
    <CustomerDeliveryDetailScreen deliveryNoteID={id} onChanged={() => navigation.changed(origin)} />
  </CustomerPage>;
}

export function CustomerNotificationsRoute() {
  const { text } = useCustomerText(), navigation = useCustomerNavigation('android');
  const [clearAction, setClearAction] = useState<(() => void) | null>(null);
  const onClearActionChanged = useCallback((action: (() => void) | null) => { setClearAction(() => action); }, []);
  return <CustomerPage title={text('notificationsTitle')} active="notifications" root clearAction={() => clearAction?.()}>
    <CustomerNotificationsScreen onOpenDetail={id => navigation.openDetail(id, 'notifications')} onClearActionChanged={onClearActionChanged} />
  </CustomerPage>;
}

export function CustomerProfileRoute() {
  const { session, onLogout } = useCustomerContext(), { text } = useCustomerText();
  return <CustomerPage title={text('profileTitle')} active={null} root>
    <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.dismissTo('/android-customer' as Href)} />
  </CustomerPage>;
}

export function CustomerChatLayout() {
  const { session } = useCustomerContext(), drawer = useRoleDrawer();
  return <ChatRouteProvider session={session} basePath="/android-customer/chat" onOpenDrawer={drawer.open}><ChatRouteStack /></ChatRouteProvider>;
}

export function CustomerChatHome() {
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }}><ChatListPage /></View><CustomerDock active="chat" /></View>;
}
