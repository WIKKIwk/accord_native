import { Button, HStack, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { WerkaArchiveListDateFilter } from './WerkaArchiveListDateFilter.ios';
import { werkaArchiveGroups, werkaArchiveSummary, type WerkaArchiveListContentProps } from './werkaArchiveListPresentation';

/** Controlled body: calendar owner, PDF and held Paddon navigation remain outside this component. */
export function WerkaArchiveListContent(props: WerkaArchiveListContentProps) {
  const t = (key: string) => localizedGetter(key, props.locale), data = props.data;
  if (props.loading && data === null) return <PreparationList><Section><ProgressView /></Section></PreparationList>;
  if (props.error !== null && data === null) return <PreparationList><Section><Text>{t('serverDisconnectedRetry')}</Text>
    <Button label={t('retry')} onPress={() => { void props.onRefresh(); }} /></Section></PreparationList>;
  if (!data || !data.items.length) return <PreparationList>
    {props.dailyFilter ? <Section><WerkaArchiveListDateFilter filter={props.dailyFilter} locale={props.locale} /></Section> : null}
    <Section><Text>{t('archiveNoItems')}</Text></Section></PreparationList>;
  const summary = werkaArchiveSummary(data, props.locale);
  return <PreparationList refresh={props.onRefresh}>
    {props.dailyFilter ? <Section><WerkaArchiveListDateFilter filter={props.dailyFilter} locale={props.locale} /></Section> : null}
    <Section><HStack><Text>{summary.count}</Text><Spacer />
    {summary.totals.map((total, index) => <Text key={`${total}:${index}`}>{total}</Text>)}</HStack></Section><Section>
    {werkaArchiveGroups(data.items, props.kind).map(group => <HStack key={group.key}><VStack alignment="leading" spacing={3}>
      <Text>{group.title}</Text>{group.subtitle.trim() ? <Text>{group.subtitle}</Text> : null}</VStack><Spacer /><Text>{group.trailing}</Text></HStack>)}
  </Section></PreparationList>;
}
