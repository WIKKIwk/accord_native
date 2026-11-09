import { Button, Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { WerkaArchivePeriodGrid } from './WerkaArchivePeriodGrid.android';
import { werkaSentArchiveBody, werkaSentArchivePresentation, type WerkaSentArchiveContentProps } from './werkaSentArchiveModel';

/** Controlled card content only. A verified daily calendar is required; no route or controller uses this body yet. */
export function WerkaSentArchiveContent(props: WerkaSentArchiveContentProps) {
  const colors = useMaterialColors(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const body = werkaSentArchiveBody(props.loading, props.error, props.activeDays, props.activeMonths, props.activeYears);
  const t = (key: string) => localizedGetter(key, props.locale);
  if (body === 'loading') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (body === 'error') return <View><PreparationText>{t('serverDisconnectedRetry')}</PreparationText>
    <PreparationRow title={t('retry')} onPress={() => { void props.onRefresh(); }} /></View>;
  const model = werkaSentArchivePresentation(props.state, props.locale, props.formatMonthYear, props.formatMediumDate);
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    {model.headers.map(header => <WorkerQueueCard key={header.id} first last backgroundColor={colors.surfaceContainerLow}>
      <View style={{ width: '100%' }}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 8, paddingVertical: 12 }}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{header.title}</Text>
            <Text style={{ typography: 'headlineSmall' }}>{header.value}</Text>
          </Column><Button onClick={() => props.onToggle(header.id)} modifiers={[testID(`sent_archive_toggle_${header.id}`)]}
            colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
              <RNHostView matchContents><SymbolView name={{ android: header.open ? 'keyboard_arrow_up' : 'calendar_month' }}
                size={24} tintColor={colors.onSecondaryContainer} /></RNHostView><Text>{header.action}</Text>
            </Row>
          </Button></Row>
        </Host>
        <View testID={`sent_archive_panel_${header.id}`} pointerEvents={header.open ? 'auto' : 'none'}
          accessibilityElementsHidden={!header.open} importantForAccessibility={header.open ? 'auto' : 'no-hide-descendants'}
          style={{ overflow: 'hidden', ...(header.open ? {} : { height: 0, opacity: 0 }) }}>
          <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 8, paddingTop: header.id === 'daily' ? 0 : 14 }}>
            {header.id === 'daily' ? props.dailyCalendar : <WerkaArchivePeriodGrid kind="sent" variant="sent" locale={props.locale}
              formatMonthYear={props.formatMonthYear} page={header.id === 'monthly' ? { period: 'monthly', year: props.state.displayYear }
                : { period: 'yearly', firstYear: props.state.firstYear }}
              active={header.id === 'monthly' ? props.activeMonths : props.activeYears}
              onPageStep={step => { if (header.open) props.onPageStep(header.id as 'monthly' | 'yearly', step); }}
              onSelect={query => { if (header.open) props.onSelect(query); }} />}
          </Host>
        </View>
      </View>
    </WorkerQueueCard>)}
    <View style={{ height: 136 }} />
  </OrdersList>;
}
