import { BottomSheet } from '@expo/ui';
import { Button, Column, FilledTonalButton, RNHostView, Row, Spacer, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useWerkaArchivePdfSheetEvents, werkaArchivePdfSheetLabels, type WerkaArchivePdfSheetProps } from './werkaArchivePdfSheet';

/** Mount only while the source PDF-ready sheet is visible. No file operation is bound here. */
export function WerkaArchivePdfActionSheet(props: WerkaArchivePdfSheetProps) {
  const labels = werkaArchivePdfSheetLabels(props.locale), events = useWerkaArchivePdfSheetEvents(props), colors = useMaterialColors();
  return <BottomSheet isPresented showDragIndicator onDismiss={events.dismiss}
    contentPadding={{ top: 8, left: 20, right: 20, bottom: 20 }}>
    <Column modifiers={[fillMaxWidth()]}>
      <Text style={{ typography: 'titleLarge' }}>{labels.title}</Text><Spacer modifiers={[height(8)]} />
      <Text style={{ typography: 'bodyMedium' }}>{labels.message}</Text><Spacer modifiers={[height(18)]} />
      <FilledTonalButton onClick={() => events.choose('files')} modifiers={[fillMaxWidth()]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <RNHostView matchContents><SymbolView name={{ android: 'folder_open' }} size={20} tintColor={colors.onSecondaryContainer} /></RNHostView>
          <Text>{labels.files}</Text>
        </Row>
      </FilledTonalButton><Spacer modifiers={[height(10)]} />
      <FilledTonalButton onClick={() => events.choose('photos')} modifiers={[fillMaxWidth()]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <RNHostView matchContents><SymbolView name={{ android: 'photo_library' }} size={20} tintColor={colors.onSecondaryContainer} /></RNHostView>
          <Text>{labels.photos}</Text>
        </Row>
      </FilledTonalButton><Spacer modifiers={[height(10)]} />
      <Button onClick={() => events.choose('share')} modifiers={[fillMaxWidth()]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <RNHostView matchContents><SymbolView name={{ android: 'ios_share' }} size={20} tintColor={colors.onPrimary} /></RNHostView>
          <Text>{labels.share}</Text>
        </Row>
      </Button>
    </Column>
  </BottomSheet>;
}
