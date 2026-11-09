import { Button, HStack, Image, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, buttonStyle, clipped, disabled, font, frame, hidden, padding } from '@expo/ui/swift-ui/modifiers';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { WerkaArchivePeriodGrid } from './WerkaArchivePeriodGrid.ios';
import { werkaSentArchiveBody, werkaSentArchivePresentation, type WerkaSentArchiveContentProps } from './werkaSentArchiveModel';

/** Controlled card content only. A verified daily calendar is required; no route or controller uses this body yet. */
export function WerkaSentArchiveContent(props: WerkaSentArchiveContentProps) {
  const body = werkaSentArchiveBody(props.loading, props.error, props.activeDays, props.activeMonths, props.activeYears);
  const t = (key: string) => localizedGetter(key, props.locale);
  if (body === 'loading') return <PreparationList><Section><ProgressView /></Section></PreparationList>;
  if (body === 'error') return <PreparationList><Section><Text>{t('serverDisconnectedRetry')}</Text>
    <Button label={t('retry')} onPress={() => { void props.onRefresh(); }} /></Section></PreparationList>;
  const model = werkaSentArchivePresentation(props.state, props.locale, props.formatMonthYear, props.formatMediumDate);
  return <PreparationList refresh={props.onRefresh}>{model.headers.map(header => <Section key={header.id}>
    <VStack spacing={0}>
      <HStack><VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ textStyle: 'caption' })]}>{header.title}</Text>
        <Text modifiers={[font({ textStyle: 'title2' })]}>{header.value}</Text>
      </VStack><Spacer /><Button onPress={() => props.onToggle(header.id)} modifiers={[buttonStyle('bordered'),
        frame({ minHeight: 48 }), accessibilityIdentifier(`sent_archive_toggle_${header.id}`)]}>
        <HStack><Image systemName={header.open ? 'chevron.up' : 'calendar'} /><Text>{header.action}</Text></HStack>
      </Button></HStack>
      <VStack modifiers={[frame({ height: header.open ? undefined : 0, alignment: 'top' }), clipped(), hidden(!header.open),
        disabled(!header.open), accessibilityHidden(!header.open), accessibilityIdentifier(`sent_archive_panel_${header.id}`)]}>
        <VStack modifiers={[padding({ top: header.id === 'daily' ? 0 : 14 })]}>
          {header.id === 'daily' ? props.dailyCalendar : <WerkaArchivePeriodGrid kind="sent" variant="sent" locale={props.locale}
            formatMonthYear={props.formatMonthYear} page={header.id === 'monthly' ? { period: 'monthly', year: props.state.displayYear }
              : { period: 'yearly', firstYear: props.state.firstYear }}
            active={header.id === 'monthly' ? props.activeMonths : props.activeYears}
            onPageStep={step => { if (header.open) props.onPageStep(header.id as 'monthly' | 'yearly', step); }}
            onSelect={query => { if (header.open) props.onSelect(query); }} />}
        </VStack>
      </VStack>
    </VStack>
  </Section>)}</PreparationList>;
}
