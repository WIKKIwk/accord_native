import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, buttonStyle, clipped, disabled, font, frame, hidden, padding } from '@expo/ui/swift-ui/modifiers';
import { localizedGetter } from '../shared/localization';
import type { WerkaArchiveListDailyFilter } from './werkaArchiveListPresentation';

/** Controlled daily filter only; the caller supplies the guarded calendar subtree. */
export function WerkaArchiveListDateFilter({ filter, locale }: { filter: WerkaArchiveListDailyFilter; locale: string }) {
  return <VStack alignment="leading" spacing={0}><HStack><VStack alignment="leading" spacing={2}>
    <Text modifiers={[font({ textStyle: 'caption' })]}>{localizedGetter('archiveDateTitle', locale)}</Text>
    <Text modifiers={[font({ textStyle: 'title2' })]}>{filter.selectedDateLabel}</Text>
  </VStack><Spacer /><Button onPress={filter.onToggle} modifiers={[buttonStyle('bordered'), frame({ minHeight: 40 }),
    accessibilityIdentifier('archive_list_date_toggle')]}><HStack>
    <Image systemName={filter.calendarOpen ? 'chevron.up' : 'calendar'} /><Text>{localizedGetter('archiveSelectDateAction', locale)}</Text>
  </HStack></Button></HStack>
  <VStack modifiers={[frame({ height: filter.calendarOpen ? undefined : 0, alignment: 'top' }), clipped(), hidden(!filter.calendarOpen),
    disabled(!filter.calendarOpen), accessibilityHidden(!filter.calendarOpen), accessibilityIdentifier('archive_list_date_calendar')]}>
    <VStack modifiers={[padding({ top: 8 })]}>{filter.renderCalendar(filter.calendarOpen)}</VStack>
  </VStack></VStack>;
}
