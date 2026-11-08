import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { werkaArchiveGroups, werkaArchiveSummary, type WerkaArchiveListContentProps } from './werkaArchiveListPresentation';

/** Read-only body: daily calendar, PDF and held Paddon navigation remain outside this component. */
export function WerkaArchiveListContent(props: WerkaArchiveListContentProps) {
  const t = (key: string) => localizedGetter(key, props.locale), data = props.data, colors = useMaterialColors();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  if (props.loading && data === null) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (props.error !== null && data === null) return <View><PreparationText>{t('serverDisconnectedRetry')}</PreparationText>
    <PreparationRow title={t('retry')} onPress={() => { void props.onRefresh(); }} /></View>;
  if (!data || !data.items.length) return <PreparationRow title={t('archiveNoItems')} />;
  const summary = werkaArchiveSummary(data, props.locale);
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    <PreparationRow title={summary.count} trailing={<Text style={{ color: colors.onSurfaceVariant }}>{summary.totals.join('  ')}</Text>} />
    {werkaArchiveGroups(data.items, props.kind).map(group => <PreparationRow key={group.key} title={group.title} subtitle={group.subtitle.trim() ? group.subtitle : undefined}
      trailing={<Text style={{ color: colors.onSurfaceVariant }}>{group.trailing}</Text>} />)}<View style={{ height: 110 }} />
  </OrdersList>;
}
