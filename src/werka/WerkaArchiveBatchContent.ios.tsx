import { Button, HStack, Image, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, buttonStyle, disabled, font, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaArchiveBatchPresentation, type WerkaArchiveBatchContentProps } from './werkaArchiveBatchPresentation';

/** Read-only panel; picker, send, routes and guarded state are intentionally not connected. */
export function WerkaArchiveBatchContent(props: WerkaArchiveBatchContentProps) {
  const view = werkaArchiveBatchPresentation(props);
  return <PreparationList><Section><VStack alignment="leading" spacing={12}>
    <HStack><VStack alignment="leading" spacing={4}><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{view.title}</Text>
      <Text>{view.subtitle}</Text></VStack><Spacer />
      {props.state === 'loading' ? <ProgressView /> : <Image systemName={props.state === 'missing' ? 'exclamationmark.circle' : 'checkmark.circle'} size={20} />}
    </HStack>
    <HStack spacing={8} modifiers={[accessibilityIdentifier('archive_batch_metrics')]}>
      {view.metrics.map(metric => <VStack key={metric.label} alignment="leading" spacing={3}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'caption' })]}>{metric.label}</Text><Text modifiers={[lineLimit(1)]}>{metric.value}</Text>
      </VStack>)}
    </HStack>
    <VStack alignment="leading" spacing={7}>{view.infoRows.map((row, index) => <HStack key={`${row.label}:${index}`} spacing={10}>
      <Text modifiers={[frame({ width: 96, alignment: 'leading' })]}>{row.label}</Text><Text>{row.value}</Text>
    </HStack>)}</VStack>
  </VStack></Section>{view.showScanActions ? <Section><HStack spacing={12}>
    <Button label={view.scanLabel} systemImage="qrcode.viewfinder" modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity }), disabled(true)]} />
    <Button label={view.backLabel} systemImage="arrow.left" modifiers={[buttonStyle('borderedProminent'), frame({ maxWidth: Infinity }), disabled(true)]} />
  </HStack></Section> : null}</PreparationList>;
}
