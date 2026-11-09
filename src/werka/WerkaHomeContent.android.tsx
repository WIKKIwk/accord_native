import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerExpansion } from '../components/WorkerExpansion';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { werkaHomeQuantity, werkaHomeRecordTarget, werkaHomeStatusRows, type WerkaHomeContentProps } from './werkaHomePresentation';

/** Reuses native preparation rows; account binding, title, drawer, dock and navigation remain outside this body. */
export function WerkaHomeContent(props: WerkaHomeContentProps) {
  const colors = useMaterialColors(), t = (key: string) => localizedGetter(key, props.locale);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  if (props.loading && !props.loaded) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  const retry = props.error != null && !props.loaded;
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    {retry ? <PreparationText>{t('serverDisconnectedRetry')}</PreparationText> : null}
    {retry ? <PreparationRow title={t('retry')} onPress={() => { void props.onRefresh(); }} /> : null}
    {!retry ? werkaHomeStatusRows(props.summary, props.locale).map(row => <PreparationRow key={row.kind} title={row.title}
      trailing={<Text style={{ color: colors.onSurfaceVariant }}>{String(row.count)}</Text>} onPress={() => props.onOpenStatus(row.kind)} />) : null}
    {!retry && props.pending.length > 0 ? <View style={{ marginTop: 16 }}>
        <WorkerQueueCard backgroundColor={colors.surface} first><View style={{ flex: 1 }}>
          <WorkerExpansion title={t('inProgressItemsTitle')} count="" expanded={props.expanded} onPress={props.onToggle} />
        </View></WorkerQueueCard>
      </View> : null}
    {!retry && props.expanded ? props.pending.map((record, index) => <PreparationRow key={`${record.id}:${index}`}
      title={record.item_name} subtitle={record.supplier_name} trailing={<View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: colors.onSurfaceVariant }}>{werkaHomeQuantity(record)}</Text>
        <Text style={{ color: colors.onSurfaceVariant }}>{record.created_label}</Text></View>}
      onPress={() => props.onOpenRecord(record, werkaHomeRecordTarget(record))} />) : null}
    <View style={{ height: 136 }} />
  </OrdersList>;
}
