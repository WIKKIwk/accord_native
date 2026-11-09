import { Button, HStack, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { werkaBreakdownPresentation, werkaDetailPresentation, werkaStatusRecordTarget, type WerkaStatusContentProps } from './werkaStatusPresentation';

/** Content only; auth lifecycle, shell, dock and safe route integration are intentionally separate. */
export function WerkaStatusContent(props: WerkaStatusContentProps) {
  const t = (key: string) => localizedGetter(key, props.locale), empty = props.items.length === 0;
  if (props.loading && empty) return <PreparationList><Section><ProgressView /></Section></PreparationList>;
  if (props.error != null && empty) return <PreparationList><Section><Text>{t('serverDisconnectedRetry')}</Text>
    <Button label={t('retry')} onPress={() => { void props.onRefresh(); }} /></Section></PreparationList>;
  if (empty) return <PreparationList><Section><Text>{t(props.mode === 'breakdown' ? 'noStatusRecords' : 'noRecordsYet')}</Text></Section></PreparationList>;
  return <PreparationList refresh={props.onRefresh}><Section>
    {props.mode === 'breakdown' ? props.items.map((entry, index) => {
      const row = werkaBreakdownPresentation(entry, props.kind, props.locale);
      return <Button key={`${entry.supplierRef}:${index}`} onPress={() => props.onOpen(entry)}><HStack>
        <VStack alignment="leading" spacing={3}><Text>{row.title}</Text><Text>{row.subtitle}</Text></VStack><Spacer /><Text>{row.trailing}</Text>
      </HStack></Button>;
    }) : props.items.map((record, index) => {
      const row = werkaDetailPresentation(record, props.locale);
      return <Button key={`${record.id}:${index}`} onPress={() => props.onOpen(record, werkaStatusRecordTarget(record, props.kind))}><HStack>
        <VStack alignment="leading" spacing={3}><Text>{row.title}</Text>{row.subtitle ? <Text>{row.subtitle}</Text> : null}</VStack><Spacer />
        <VStack alignment="trailing" spacing={4}><Text>{row.trailing}</Text><Text>{row.date}</Text></VStack>
      </HStack></Button>;
    })}
  </Section></PreparationList>;
}
