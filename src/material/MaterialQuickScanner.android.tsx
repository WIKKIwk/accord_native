import { Host, IconButton, OutlinedTextField, RNHostView, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { CameraSurface } from '../shared/camera/CameraSurface';
import { useMaterialQuickScanner } from './useMaterialQuickScanner';

type Props = { busy: boolean; status: string; isCurrent(): boolean; detect(raw: string): Promise<void>; p(key: string): string };
/** @v2 ProductionQuickScannerPanel */
export function MaterialQuickScanner({ busy, status, isCurrent, detect, p }: Props) {
  const h = useMaterialQuickScanner(busy, isCurrent, detect), colors = useMaterialColors(), input = useNativeState('');
  useEffect(() => { if (!h.manual) input.set(''); }, [h.manual, input]);
  const processing = busy || h.processing, unavailable = h.failed || (!!h.permission.permission && !h.permission.permission.granted);
  return <View style={{ width: '100%' }}>
    <View style={{ height: 248, alignItems: 'center', paddingTop: 12 }}>
      <View style={{ width: 218, height: 218, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraSurface active={h.cameraActive} permission={h.permission.permission} checking={h.permission.checking} facing="back" torch={false}
          barcodeTypes={['qr', 'datamatrix']} sessionKey="material-sequence-quick" isCurrent={h.cameraCurrent}
          onDetection={event => { void h.scan(event.raw || event.data); }} onMountError={h.cameraFailed} onReady={h.cameraReady} style={StyleSheet.absoluteFill} />
        {!unavailable && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff80' }} />
          <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff80' }} />
          <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: '#ffffff80' }} />
          <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: '#ffffff80' }} />
          {!h.ready && <ActivityIndicator color="white" style={{ flex: 1 }} />}
        </View>}
        {unavailable ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>{p('worker.scanner.unavailable')}</Text>
        </View> : <View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, bottom: 12,
          backgroundColor: '#000a', borderRadius: 18, padding: 10 }}>
          {processing ? <ActivityIndicator color="white" /> : null}
          <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>{processing ? p('worker.scanner.checking') : status}</Text>
        </View>}
      </View>
      <Host matchContents style={{ position: 'absolute', right: 8, bottom: 8 }}><IconButton onClick={h.toggleManual}
        modifiers={[semantics({ contentDescription: p(h.manualVisible ? 'worker.scanner.manual.hide' : 'worker.scanner.manual.show') })]}>
        <RNHostView matchContents><SymbolView name={{ android: h.manualVisible ? 'close' : 'edit' }} size={24} tintColor={colors.primary} /></RNHostView>
      </IconButton></Host>
    </View>
    {h.manualVisible ? <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
      <View style={{ flex: 1 }}><Host matchContents={{ vertical: true }}><OutlinedTextField value={input} onValueChange={h.setManual}
        enabled={!processing} singleLine keyboardOptions={{ imeAction: 'done' }} keyboardActions={{ onDone: () => { void h.submitManual(); } }} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Label><ComposeText>{p('worker.scanner.manual.label')}</ComposeText></OutlinedTextField.Label>
      </OutlinedTextField></Host></View>
      <View style={{ width: 92 }}><WorkerSheetButton label={p('worker.scanner.accept')} variant="filled" disabled={processing}
        onPress={() => { void h.submitManual(); }} icon={{ android: 'check' }} /></View>
    </View> : null}
  </View>;
}
