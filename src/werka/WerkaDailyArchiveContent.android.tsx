import { Button, Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { PreparationRow, PreparationText } from '../preparation/PreparationUI.android';
import { localizedGetter } from '../shared/localization';
import { OrdersList } from '../shared/orders/OrdersList';
import { werkaArchivePeriodBody } from './werkaArchivePeriodPresentation';
import { werkaDailyArchivePresentation, type WerkaDailyArchiveContentProps } from './werkaDailyArchiveModel';

/** Controlled content only: no request, account guard, picker owner or route is created. */
export function WerkaDailyArchiveContent(props: WerkaDailyArchiveContentProps) {
  const colors = useMaterialColors(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const body = werkaArchivePeriodBody(props.loading, props.error, props.activeDays);
  if (body === 'loading') return <View style={{ flex: 1 }} />;
  if (body === 'error') return <View><PreparationText>{localizedGetter('serverDisconnectedRetry', props.locale)}</PreparationText>
    <PreparationRow title={localizedGetter('retry', props.locale)} onPress={() => { void props.onRefresh(); }} /></View>;
  const model = werkaDailyArchivePresentation(props.kind, props.state, props.activeDays, props.loading, props.error, props.locale);
  return <OrdersList active onRefresh={props.onRefresh} headerOffset={headerOffset} headerHeight={headerHeight} topInset={4} passthrough={() => true}>
    <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLow}><View style={{ width: '100%' }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 8, paddingVertical: 12 }}>
        <Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 10 }}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{model.dateTitle}</Text>
            <Text style={{ typography: 'headlineSmall' }}>{model.selectedDateLabel}</Text>
          </Column><Button onClick={props.onToggle} modifiers={[testID('daily_archive_toggle')]}
            colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
              <RNHostView matchContents><SymbolView name={{ android: model.calendarOpen ? 'keyboard_arrow_up' : 'calendar_month' }}
                size={24} tintColor={colors.onSecondaryContainer} /></RNHostView><Text>{model.action}</Text>
            </Row>
          </Button></Row>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{model.summary}</Text>
        </Column>
      </Host>
      <View testID="daily_archive_calendar" pointerEvents={model.calendarOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!model.calendarOpen} importantForAccessibility={model.calendarOpen ? 'auto' : 'no-hide-descendants'}
        style={{ overflow: 'hidden', ...(model.calendarOpen ? {} : { height: 0, opacity: 0 }) }}>
        <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 8, paddingTop: 12 }}>
          {props.renderCalendar(model.calendarOpen)}
        </Host>
      </View>
    </View></WorkerQueueCard><View style={{ height: 136 }} />
  </OrdersList>;
}
