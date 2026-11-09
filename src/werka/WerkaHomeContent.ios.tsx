import { Button, HStack, Image, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { werkaHomeQuantity, werkaHomeRecordTarget, werkaHomeStatusRows, type WerkaHomeContentProps } from './werkaHomePresentation';

/** Reuses the native preparation list; account binding, title, drawer, dock and navigation remain outside this body. */
export function WerkaHomeContent(props: WerkaHomeContentProps) {
  const t = (key: string) => localizedGetter(key, props.locale);
  if (props.loading && !props.loaded) return <PreparationList><Section><ProgressView /></Section></PreparationList>;
  if (props.error != null && !props.loaded) return <PreparationList refresh={props.onRefresh}><Section>
    <Text>{t('serverDisconnectedRetry')}</Text><Button label={t('retry')} onPress={() => { void props.onRefresh(); }} />
  </Section></PreparationList>;
  return <PreparationList refresh={props.onRefresh}><Section>
    {werkaHomeStatusRows(props.summary, props.locale).map(row => <Button key={row.kind} onPress={() => props.onOpenStatus(row.kind)}>
      <HStack><Text>{row.title}</Text><Spacer /><Text>{String(row.count)}</Text></HStack>
    </Button>)}
  </Section>{props.pending.length > 0 ? <Section>
    <Button onPress={props.onToggle}><HStack><Text>{t('inProgressItemsTitle')}</Text><Spacer />
      <Image systemName={props.expanded ? 'chevron.up' : 'chevron.down'} /></HStack></Button>
    {props.expanded ? props.pending.map((record, index) => <Button key={`${record.id}:${index}`}
      onPress={() => props.onOpenRecord(record, werkaHomeRecordTarget(record))}>
      <HStack><VStack alignment="leading" spacing={3}><Text>{record.item_name}</Text><Text>{record.supplier_name}</Text></VStack><Spacer />
        <VStack alignment="trailing" spacing={4}><Text>{werkaHomeQuantity(record)}</Text><Text>{record.created_label}</Text></VStack></HStack>
    </Button>) : null}
  </Section> : null}</PreparationList>;
}
