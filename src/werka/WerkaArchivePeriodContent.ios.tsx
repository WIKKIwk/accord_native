import { Button, Section, Text } from '@expo/ui/swift-ui';
import { View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { localizedGetter } from '../shared/localization';
import { WerkaArchivePeriodGrid } from './WerkaArchivePeriodGrid.ios';
import { werkaArchivePeriodBody, type WerkaArchivePeriodContentProps } from './werkaArchivePeriodPresentation';

/** Controlled month/year content only. The owner supplies safe loads, locale labels, shell and navigation. */
export function WerkaArchivePeriodContent(props: WerkaArchivePeriodContentProps) {
  const body = werkaArchivePeriodBody(props.loading, props.error, props.active);
  if (body === 'loading') return <View style={{ flex: 1 }} />;
  if (body === 'error') return <PreparationList><Section>
    <Text>{localizedGetter('serverDisconnectedRetry', props.locale)}</Text>
    <Button label={localizedGetter('retry', props.locale)} onPress={() => { void props.onRefresh(); }} />
  </Section></PreparationList>;
  return <PreparationList refresh={props.onRefresh}><Section><WerkaArchivePeriodGrid {...props} /></Section></PreparationList>;
}
