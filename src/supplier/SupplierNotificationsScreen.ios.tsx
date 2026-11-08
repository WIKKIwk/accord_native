import { Button, HStack, Image, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { listRowBackground } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactElement } from 'react';
import { PlatformColor, Pressable, View } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import type { WorkerAlertData } from '../components/workerDialogTypes';
import { PreparationList } from '../preparation/PreparationUI';
import { RoleHeaderButton } from '../shared/navigation/RoleHeaderButton';
import { supplierNotificationMetric, supplierNotificationSecondary, supplierNotificationStatusIcon } from './supplierScreenModel';
import type { SupplierNotificationsProps } from './supplierNotificationsTypes';
import { useSupplierNotifications } from './useSupplierNotifications';
import { useSupplierText } from './useSupplierOverview';

const icons = { clock: 'clock', doneAll: 'checkmark.circle.fill', check: 'checkmark', close: 'xmark', remove: 'minus' } as const;
function ReceiptRow({ children, onPress, highlighted }: { children: ReactElement; onPress?: () => void; highlighted: boolean }) {
  const modifiers = highlighted ? [listRowBackground(PlatformColor('systemFill'))] : undefined;
  return onPress ? <Button onPress={onPress} modifiers={modifiers}>{children}</Button>
    : <VStack modifiers={modifiers}>{children}</VStack>;
}

// @v2 SupplierNotificationsScreen
export function SupplierNotificationsScreen(props: SupplierNotificationsProps) {
  const { controller, items, highlighted, store } = useSupplierNotifications(props), { l, menuTooltip } = useSupplierText();
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const loading = !store.loadedHistory && !store.historyError && !items.length;
  const failed = !store.loadedHistory && store.historyError != null && !items.length;
  const clear = () => setAlert({ title: l('clearTitle'), message: l('clearAllNotificationsPrompt'),
    cancelLabel: l('no'), confirmLabel: l('yes'), onConfirm: () => { void controller.clearAll(); } });
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: l('notificationsTitle'),
    headerLeft: () => <RoleHeaderButton icon={props.onRootBack ? 'back' : 'menu'} label={props.onRootBack ? 'Orqaga' : menuTooltip}
      onPress={props.onRootBack ?? props.onOpenDrawer} tintColor={PlatformColor('label')} />,
    headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel={l('clearTitle')} onPress={clear} hitSlop={10}>
      <SymbolView name="line.3.horizontal.decrease.circle" size={24} tintColor={PlatformColor('label')} /></Pressable> }} />
    <PreparationList refresh={!loading ? () => controller.reload() : undefined}>
      {loading ? <ProgressView /> : failed ? <Section><Text>{l('serverDisconnectedRetry')}</Text>
        <Button label={l('retry')} onPress={() => { void controller.reload(); }} /></Section>
        : !items.length ? <Section><Text>{l('noNotifications')}</Text></Section> : <Section>{items.map((record, index) =>
          <ReceiptRow key={`${record.id}:${index}`} highlighted={highlighted.has(record.id)}
            onPress={props.onReceipt ? () => { void controller.open(record.id); } : undefined}>
            <VStack alignment="leading" spacing={6}><HStack><Text>{record.item_code}</Text><Spacer />
              <Image systemName={icons[supplierNotificationStatusIcon(record)]} /></HStack>
              <Text>{supplierNotificationSecondary(record)}</Text><HStack><Text>{supplierNotificationMetric(record)}</Text>
                <Spacer /><Text>{record.created_label}</Text></HStack></VStack>
          </ReceiptRow>)}</Section>}
    </PreparationList>{props.footer}<WorkerAlert alert={alert} onDismiss={() => setAlert(null)} /></View>;
}
