import { BottomSheet } from '@expo/ui';
import { Button, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, frame } from '@expo/ui/swift-ui/modifiers';
import { useWerkaArchivePdfSheetEvents, werkaArchivePdfSheetLabels, type WerkaArchivePdfSheetProps } from './werkaArchivePdfSheet';

/** Mount only while the source PDF-ready sheet is visible. No file operation is bound here. */
export function WerkaArchivePdfActionSheet(props: WerkaArchivePdfSheetProps) {
  const labels = werkaArchivePdfSheetLabels(props.locale), events = useWerkaArchivePdfSheetEvents(props);
  const width = frame({ maxWidth: Infinity });
  return <BottomSheet isPresented showDragIndicator onDismiss={events.dismiss}
    contentPadding={{ top: 8, left: 20, right: 20, bottom: 20 }}>
    <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'title2' })]}>{labels.title}</Text><Spacer modifiers={[frame({ height: 8 })]} />
      <Text modifiers={[font({ textStyle: 'body' })]}>{labels.message}</Text><Spacer modifiers={[frame({ height: 18 })]} />
      <Button label={labels.files} systemImage="folder" onPress={() => events.choose('files')}
        modifiers={[buttonStyle('bordered'), width]} /><Spacer modifiers={[frame({ height: 10 })]} />
      <Button label={labels.photos} systemImage="photo.on.rectangle" onPress={() => events.choose('photos')}
        modifiers={[buttonStyle('bordered'), width]} /><Spacer modifiers={[frame({ height: 10 })]} />
      <Button label={labels.share} systemImage="square.and.arrow.up" onPress={() => events.choose('share')}
        modifiers={[buttonStyle('borderedProminent'), width]} />
    </VStack>
  </BottomSheet>;
}
