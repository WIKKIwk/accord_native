import { Host } from '@expo/ui/jetpack-compose';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { WerkaArchivePeriodGrid } from './WerkaArchivePeriodGrid.android';
import { werkaArchivePeriodBody, type WerkaArchivePeriodContentProps } from './werkaArchivePeriodPresentation';

/** Controlled month/year content only. The owner supplies safe loads, locale labels, shell and navigation. */
export function WerkaArchivePeriodContent(props: WerkaArchivePeriodContentProps) {
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const body = werkaArchivePeriodBody(props.loading, props.error, props.active);
  if (body === 'loading') return <View style={{ flex: 1 }} />;
  if (body === 'error') return <View><PreparationText>{localizedGetter('serverDisconnectedRetry', props.locale)}</PreparationText>
    <PreparationRow title={localizedGetter('retry', props.locale)} onPress={() => { void props.onRefresh(); }} /></View>;
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 18 }}><WerkaArchivePeriodGrid {...props} /></Host>
    <View style={{ height: 136 }} />
  </OrdersList>;
}
