import { Button, HStack, Image, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, buttonStyle, font, frame } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { werkaArchivePeriodBody, werkaArchivePeriodPresentation, type WerkaArchivePeriodContentProps } from './werkaArchivePeriodPresentation';

/** Controlled month/year content only. The owner supplies safe loads, locale labels, shell and navigation. */
export function WerkaArchivePeriodContent(props: WerkaArchivePeriodContentProps) {
  const body = werkaArchivePeriodBody(props.loading, props.error, props.active);
  if (body === 'loading') return <View style={{ flex: 1 }} />;
  if (body === 'error') return <PreparationList><Section>
    <Text>{localizedGetter('serverDisconnectedRetry', props.locale)}</Text>
    <Button label={localizedGetter('retry', props.locale)} onPress={() => { void props.onRefresh(); }} />
  </Section></PreparationList>;
  const model = werkaArchivePeriodPresentation(props.kind, props.page, props.active, props.locale, props.formatMonthYear);
  return <PreparationList refresh={props.onRefresh}><Section><VStack spacing={12}>
    <HStack>
      <Button onPress={() => props.onPageStep(-1)} modifiers={[buttonStyle('borderless'),
        frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.previousLabel), accessibilityIdentifier('archive_previous_page')]}>
        <Image systemName="chevron.left" />
      </Button><Spacer /><Text>{model.pageLabel}</Text><Spacer />
      <Button onPress={() => props.onPageStep(1)} modifiers={[buttonStyle('borderless'),
        frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.nextLabel), accessibilityIdentifier('archive_next_page')]}>
        <Image systemName="chevron.right" />
      </Button>
    </HStack>
    {model.rows.map((row, index) => <HStack key={index} spacing={10}>{row.map(cell =>
      <Button key={cell.id} onPress={() => props.onSelect(cell.query)} modifiers={[
        buttonStyle(cell.active ? 'borderedProminent' : 'bordered'), accessibilityIdentifier(cell.id)]}>
        <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 44 }), font({ textStyle: 'body', weight: cell.active ? 'bold' : 'medium' })]}>{cell.label}</Text>
      </Button>)}</HStack>)}
    {model.emptyLabel !== null ? <Text>{model.emptyLabel}</Text> : null}
  </VStack></Section></PreparationList>;
}
