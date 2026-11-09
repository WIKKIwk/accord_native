import { Button, Column, Host, IconButton, RNHostView, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics, weight } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export function QolipQrScannerScreen(props: QolipQrScannerProps) {
  const scan = useQolipQrScanner(props), { text } = scan, insets = useSafeAreaInsets();
  const { close } = scan;
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', close);
    return () => listener.remove();
  }, [close]));
  if (!scan.valid) return null;
  const flashLabel = text(scan.camera.torch ? 'scanner.flash_off' : 'scanner.flash_on');
  return <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: insets.top }}>
    <Host matchContents={{ vertical: true }}><Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
      <IconButton onClick={scan.close} modifiers={[semantics({ contentDescription: text('action.back') })]}><RNHostView matchContents>
        <SymbolView name={{ android: 'arrow_back' }} size={24} tintColor="#ffffff" /></RNHostView></IconButton>
      <Text color="#ffffff" style={{ typography: 'titleLarge', fontWeight: '800' }} modifiers={[weight(1)]}>{scan.title}</Text>
    </Row></Host>
    <QolipQrScannerPreview scan={scan}
      error={<Host matchContents><Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 14 }}>
        <RNHostView matchContents><SymbolView name={{ android: 'videocam_off' }} size={42} tintColor="#ffffff" /></RNHostView>
        <Text color="#ffffff" style={{ typography: 'titleMedium', fontWeight: '800' }}>{text('scanner.failed')}</Text>
        <Text color="#ffffff" style={{ textAlign: 'center' }}>{text('scanner.camera_retry')}</Text>
        <Button onClick={scan.retry}><Text>{text('action.retry')}</Text></Button>
      </Column></Host>}
      status={<Host matchContents><Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
        <RNHostView matchContents>{scan.state.processing ? <ActivityIndicator color="#ffffff" />
          : <SymbolView name={{ android: 'qr_code_scanner' }} size={18} tintColor="#ffffff" />}</RNHostView>
        <Text color="#ffffff" style={{ typography: 'titleSmall', fontWeight: '600' }}>{scan.status}</Text></Row></Host>}
      torch={<Host matchContents><IconButton onClick={scan.camera.toggleTorch} modifiers={[semantics({ contentDescription: flashLabel })]}>
        <RNHostView matchContents><SymbolView name={{ android: scan.camera.torch ? 'flash_on' : 'flash_off' }} size={22} tintColor="#ffffff" /></RNHostView>
      </IconButton></Host>} />
    <PreparationNotice message={scan.notice} />
  </View>;
}
