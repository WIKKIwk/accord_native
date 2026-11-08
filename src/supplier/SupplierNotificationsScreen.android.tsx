import { Host, IconButton, RNHostView, Text as ComposeText, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerAlert } from '../components/WorkerAlert';
import type { WorkerAlertData } from '../components/workerDialogTypes';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { PreparationText } from '../preparation/PreparationUI';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { supplierNotificationMetric, supplierNotificationSecondary, supplierNotificationStatusIcon } from './supplierScreenModel';
import type { SupplierNotificationsProps } from './supplierNotificationsTypes';
import { useSupplierNotifications } from './useSupplierNotifications';
import { useSupplierText } from './useSupplierOverview';

const icons: Record<ReturnType<typeof supplierNotificationStatusIcon>, AndroidSymbol> = {
  clock: 'schedule', doneAll: 'done_all', check: 'check', close: 'close', remove: 'remove',
};

// @v2 SupplierNotificationsScreen
export function SupplierNotificationsScreen(props: SupplierNotificationsProps) {
  const { controller, items, highlighted, store } = useSupplierNotifications(props), { l, menuTooltip } = useSupplierText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const loading = !store.loadedHistory && store.historyError == null && !items.length;
  const failed = !store.loadedHistory && store.historyError != null && !items.length;
  const clear = () => setAlert({ title: l('clearTitle'), message: l('clearAllNotificationsPrompt'),
    cancelLabel: l('no'), confirmLabel: l('yes'), onConfirm: () => { void controller.clearAll(); } });
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}>
      <RoleHeader title={l('notificationsTitle')} navigation={{ icon: props.onRootBack ? 'back' : 'menu',
        label: props.onRootBack ? 'Orqaga' : menuTooltip, onPress: props.onRootBack ?? props.onOpenDrawer }} />
    </View><Host matchContents><IconButton onClick={clear} modifiers={[testID('supplier-clear-notifications'), semantics({ contentDescription: l('clearTitle') })]}>
      <RNHostView matchContents><SymbolView name={{ android: 'clear_all' }} size={24} tintColor={colors.onSurface} /></RNHostView>
    </IconButton></Host></View>
    {loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View> : <ScrollView
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={store.loadingHistory} onRefresh={() => { void controller.reload(); }} />}>
      {failed ? <View style={{ padding: 24, gap: 16 }}><PreparationText>{l('serverDisconnectedRetry')}</PreparationText>
        <Host matchContents={{ vertical: true }}><TextButton onClick={() => { void controller.reload(); }}><ComposeText>{l('retry')}</ComposeText></TextButton></Host></View>
        : !items.length ? <PreparationText>{l('noNotifications')}</PreparationText> : items.map((record, index) => {
          const selected = highlighted.has(record.id), foreground = selected ? colors.onSecondaryContainer : colors.onSurface;
          return <WorkerQueueCard key={`${record.id}:${index}`} first={index === 0} last={index === items.length - 1}
            backgroundColor={selected ? colors.secondaryContainer : colors.surfaceContainerLow}
            onPress={props.onReceipt ? () => { void controller.open(record.id); } : undefined}>
            <View style={{ flex: 1, gap: 6 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: foreground, fontSize: 18 }}>{record.item_code}</Text>
              <SymbolView name={{ android: icons[supplierNotificationStatusIcon(record)] }} size={18} tintColor={foreground} /></View>
              <Text numberOfLines={1} style={{ color: foreground }}>{supplierNotificationSecondary(record)}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}><Text numberOfLines={1} style={{ flex: 1, color: foreground }}>{supplierNotificationMetric(record)}</Text>
                <Text style={{ color: foreground }}>{record.created_label}</Text></View>
            </View>
          </WorkerQueueCard>;
        })}
    </ScrollView>}
    {props.footer}<WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
  </View>;
}
