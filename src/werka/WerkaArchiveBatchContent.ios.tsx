import { HStack, Image, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaArchiveBatchPresentation, type WerkaArchiveBatchContentProps } from './werkaArchiveBatchPresentation';

/** Read-only panel; picker, send, routes and guarded state are intentionally not connected. */
export function WerkaArchiveBatchContent(props: WerkaArchiveBatchContentProps) {
  const view = werkaArchiveBatchPresentation(props);
  return <PreparationList><Section><HStack><VStack alignment="leading" spacing={4}><Text>{view.title}</Text><Text>{view.subtitle}</Text></VStack><Spacer />
    {props.state === 'loading' ? <ProgressView /> : <Image systemName={props.state === 'missing' ? 'exclamationmark.circle' : 'checkmark.circle'} size={20} />}
  </HStack>{view.rows.map((row, index) => <HStack key={`${row.label}:${index}`}><Text>{row.label}</Text><Spacer /><Text>{row.value}</Text></HStack>)}</Section></PreparationList>;
}
