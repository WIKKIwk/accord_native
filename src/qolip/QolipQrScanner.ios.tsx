import { Button, Host, HStack, Image, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, foregroundStyle, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { QolipQrScannerPreview } from './QolipQrScannerPreview';
import { useQolipQrScanner, type QolipQrScannerProps } from './useQolipQrScanner';

type Props = Omit<QolipQrScannerProps, 'mode'>;
/** @v2 QolipCellQrScanScreen */
export function QolipCellQrScanScreen(props: Props) { return <QolipQrScannerScreen {...props} mode="cell" />; }
/** @v2 QolipRawQrScanScreen */
export function QolipRawQrScanScreen(props: Props) { return <QolipQrScannerScreen {...props} mode="raw" />; }
/** @v2 QolipUniversalQrScanScreen */
export function QolipUniversalQrScanScreen(props: Props) { return <QolipQrScannerScreen {...props} mode="universal" />; }

/** Render as a real Stack page; it adds no standalone unguarded app route. */
export function QolipQrScannerScreen(props: QolipQrScannerProps) {
  const scan = useQolipQrScanner(props), { text } = scan;
  if (!scan.valid) return null;
  const white = [foregroundStyle('#ffffff')];
  const flashLabel = text(scan.camera.torch ? 'scanner.flash_off' : 'scanner.flash_on');
  return <View style={{ flex: 1, backgroundColor: '#000000' }}>
    <Stack.Screen options={{ title: scan.title, headerStyle: { backgroundColor: '#000000' }, headerTintColor: '#ffffff',
      headerLeft: () => <Host matchContents><Button label={text('action.back')} systemImage="chevron.left" onPress={scan.close}
        modifiers={[labelStyle('iconOnly'), accessibilityLabel(text('action.back')), foregroundStyle('#ffffff')]} /></Host> }} />
    <QolipQrScannerPreview scan={scan}
      error={<Host matchContents><VStack spacing={14}><Image systemName="video.slash" size={42} color="#ffffff" />
        <Text modifiers={white}>{text('scanner.failed')}</Text><Text modifiers={white}>{text('scanner.camera_retry')}</Text>
        <Button label={text('action.retry')} systemImage="arrow.left" modifiers={[buttonStyle('borderedProminent')]} onPress={scan.retry} />
      </VStack></Host>}
      status={<Host matchContents><HStack spacing={12}>{scan.state.processing ? <ProgressView />
        : <Image systemName="qrcode.viewfinder" size={18} color="#ffffff" />}<Text modifiers={white}>{scan.status}</Text></HStack></Host>}
      torch={<Host matchContents><Button label={flashLabel} systemImage={scan.camera.torch ? 'bolt.fill' : 'bolt.slash'}
        modifiers={[labelStyle('iconOnly'), accessibilityLabel(flashLabel), buttonStyle('bordered'), foregroundStyle('#ffffff')]}
        onPress={scan.camera.toggleTorch} /></Host>} />
    <PreparationNotice message={scan.notice} />
  </View>;
}
