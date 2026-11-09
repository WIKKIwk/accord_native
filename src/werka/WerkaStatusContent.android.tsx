import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { werkaBreakdownPresentation, werkaDetailPresentation, werkaStatusRecordTarget, type WerkaStatusContentProps } from './werkaStatusPresentation';

/** Content only; auth lifecycle, shell, dock and safe route integration are intentionally separate. */
export function WerkaStatusContent(props: WerkaStatusContentProps) {
  const colors = useMaterialColors(), t = (key: string) => localizedGetter(key, props.locale), empty = props.items.length === 0;
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  if (props.loading && empty) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (props.error != null && empty) return <View><PreparationText>{t('serverDisconnectedRetry')}</PreparationText>
    <PreparationRow title={t('retry')} onPress={() => { void props.onRefresh(); }} /></View>;
  if (empty) return <View><PreparationText>{t(props.mode === 'breakdown' ? 'noStatusRecords' : 'noRecordsYet')}</PreparationText></View>;
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    {props.mode === 'breakdown' ? props.items.map((entry, index) => {
      const row = werkaBreakdownPresentation(entry, props.kind, props.locale);
      return <PreparationRow key={`${entry.supplierRef}:${index}`} title={row.title} subtitle={row.subtitle}
        trailing={<Text style={{ color: colors.onSurfaceVariant }}>{row.trailing}</Text>} onPress={() => props.onOpen(entry)} />;
    }) : props.items.map((record, index) => {
      const row = werkaDetailPresentation(record, props.locale);
      return <PreparationRow key={`${record.id}:${index}`} title={row.title} subtitle={row.subtitle || undefined}
        trailing={<View style={{ alignItems: 'flex-end' }}><Text style={{ color: colors.onSurfaceVariant }}>{row.trailing}</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{row.date}</Text></View>}
        onPress={() => props.onOpen(record, werkaStatusRecordTarget(record, props.kind))} />;
    })}
    <View style={{ height: 136 }} />
  </OrdersList>;
}
