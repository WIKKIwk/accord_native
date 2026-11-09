import { HStack, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaDeliveryPresentation, type WerkaDeliveryContentProps } from './werkaDeliveryPresentation';

/** Read-only body. The shared notification discussion route remains under the account-safety hold. */
export function WerkaDeliveryContent(props: WerkaDeliveryContentProps) {
  const view = werkaDeliveryPresentation(props);
  return <PreparationList><Section><HStack><Text>{view.supplier}</Text><Spacer /><Text>{view.status}</Text></HStack></Section>
    <Section>{view.rows.map((row, index) => <HStack key={`${row.label}:${index}`}><Text>{row.label}</Text><Spacer /><Text>{row.value}</Text></HStack>)}</Section>
    <Section><VStack alignment="leading" spacing={10}><Text>{view.noteTitle}</Text><Text>{view.note}</Text></VStack></Section>
  </PreparationList>;
}
