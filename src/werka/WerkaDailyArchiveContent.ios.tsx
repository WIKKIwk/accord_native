import { Button, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, buttonStyle, clipped, disabled, font, frame, hidden, padding } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { werkaArchivePeriodBody } from './werkaArchivePeriodPresentation';
import { werkaDailyArchivePresentation, type WerkaDailyArchiveContentProps } from './werkaDailyArchiveModel';

/** Controlled content only: no request, account guard, picker owner or route is created. */
export function WerkaDailyArchiveContent(props: WerkaDailyArchiveContentProps) {
  const body = werkaArchivePeriodBody(props.loading, props.error, props.activeDays);
  if (body === 'loading') return <View style={{ flex: 1 }} />;
  if (body === 'error') return <PreparationList><Section>
    <Text>{localizedGetter('serverDisconnectedRetry', props.locale)}</Text>
    <Button label={localizedGetter('retry', props.locale)} onPress={() => { void props.onRefresh(); }} />
  </Section></PreparationList>;
  const model = werkaDailyArchivePresentation(props.kind, props.state, props.activeDays, props.loading, props.error, props.locale);
  return <PreparationList refresh={props.onRefresh}><Section><VStack alignment="leading" spacing={0}>
    <HStack><VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'caption' })]}>{model.dateTitle}</Text>
      <Text modifiers={[font({ textStyle: 'title2' })]}>{model.selectedDateLabel}</Text></VStack><Spacer />
      <Button onPress={props.onToggle} modifiers={[buttonStyle('bordered'), frame({ minHeight: 48 }),
        accessibilityIdentifier('daily_archive_toggle')]}><HStack>
        <Image systemName={model.calendarOpen ? 'chevron.up' : 'calendar'} /><Text>{model.action}</Text>
      </HStack></Button>
    </HStack>
    <Text modifiers={[font({ textStyle: 'caption' }), padding({ top: 10 })]}>{model.summary}</Text>
    <VStack modifiers={[frame({ height: model.calendarOpen ? undefined : 0, alignment: 'top' }), clipped(), hidden(!model.calendarOpen),
      disabled(!model.calendarOpen), accessibilityHidden(!model.calendarOpen), accessibilityIdentifier('daily_archive_calendar')]}>
      <VStack modifiers={[padding({ top: 12 })]}>{props.renderCalendar(model.calendarOpen)}</VStack>
    </VStack>
  </VStack></Section></PreparationList>;
}
