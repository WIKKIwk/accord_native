import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { OrdersList } from '../shared/orders/OrdersList';
import { orderedWerkaNotifications, werkaNotificationPresentation, type WerkaNotificationRowsProps } from './werkaNotificationPresentation';

/** Read-only rows: no unread store, clear action, detail route or subscription is connected. */
export function WerkaNotificationRows(props: WerkaNotificationRowsProps) {
  const colors = useMaterialColors(), items = orderedWerkaNotifications(props.items, props.highlightedIds);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const icons = { draft: 'schedule', pending: 'schedule', accepted: 'done_all', partial: 'check', rejected: 'close', cancelled: 'remove' } as const;
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    {items.map((record, index) => {
    const row = werkaNotificationPresentation(record, props.locale);
    return <WorkerQueueCard key={`${record.id}:${index}`} first={index === 0} last={index === items.length - 1}
      backgroundColor={props.highlightedIds.has(record.id) ? colors.secondaryContainer : colors.surface}>
      <View style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 2, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text numberOfLines={1} style={{ color: colors.onSurface, flex: 1, fontWeight: '700' }}>{row.title}</Text>
          <SymbolView name={{ android: icons[row.icon] }} size={16} tintColor={colors.onSurface} /></View>
        <Text numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{row.secondary}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}><Text numberOfLines={1} style={{ color: colors.onSurfaceVariant, flex: 1 }}>{row.metric}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{row.date}</Text></View>
      </View>
    </WorkerQueueCard>;
  })}<View style={{ height: 136 }} /></OrdersList>;
}
