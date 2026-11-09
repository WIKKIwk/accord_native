import { Button, Column, Host, RNHostView, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { localizedGetter } from '../shared/localization';
import type { WerkaArchiveListDailyFilter } from './werkaArchiveListPresentation';

/** Controlled daily filter only; the caller supplies the guarded calendar subtree. */
export function WerkaArchiveListDateFilter({ filter, locale }: { filter: WerkaArchiveListDailyFilter; locale: string }) {
  const colors = useMaterialColors();
  return <WorkerQueueCard first last backgroundColor={colors.surfaceContainerLow}><View style={{ width: '100%' }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 10 }}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 2 }}>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{localizedGetter('archiveDateTitle', locale)}</Text>
        <Text style={{ typography: 'headlineSmall' }}>{filter.selectedDateLabel}</Text>
      </Column><Button onClick={filter.onToggle} modifiers={[testID('archive_list_date_toggle')]}
        colors={{ containerColor: colors.secondaryContainer, contentColor: colors.onSecondaryContainer }}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}><RNHostView matchContents>
          <SymbolView name={{ android: filter.calendarOpen ? 'keyboard_arrow_up' : 'calendar_month' }} size={24} tintColor={colors.onSecondaryContainer} />
        </RNHostView><Text>{localizedGetter('archiveSelectDateAction', locale)}</Text></Row>
      </Button></Row>
    </Host>
    <View testID="archive_list_date_calendar" pointerEvents={filter.calendarOpen ? 'auto' : 'none'}
      accessibilityElementsHidden={!filter.calendarOpen} importantForAccessibility={filter.calendarOpen ? 'auto' : 'no-hide-descendants'}
      style={{ overflow: 'hidden', ...(filter.calendarOpen ? {} : { height: 0, opacity: 0 }) }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%', paddingHorizontal: 12, paddingTop: 8 }}>
        {filter.renderCalendar(filter.calendarOpen)}
      </Host>
    </View>
  </View></WorkerQueueCard>;
}
