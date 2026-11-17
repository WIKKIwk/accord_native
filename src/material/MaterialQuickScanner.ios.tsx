import { Button, Host, HStack, TextField, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, frame, onSubmit, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { CameraSurface } from '../shared/camera/CameraSurface';
import { useMaterialQuickScanner } from './useMaterialQuickScanner';

type Props = { busy: boolean; status: string; isCurrent(): boolean; detect(raw: string): Promise<void>; p(key: string): string };
/** @v2 ProductionQuickScannerPanel */
export function MaterialQuickScanner({ busy, status, isCurrent, detect, p }: Props) {
  const h = useMaterialQuickScanner(busy, isCurrent, detect), input = useNativeState('');
  useEffect(() => { if (!h.manual) input.set(''); }, [h.manual, input]);
  const processing = busy || h.processing, unavailable = h.failed || (!!h.permission.permission && !h.permission.permission.granted);
  return <View style={{ width: '100%' }}>
    <View style={{ height: 248, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12 }}>
      <View style={{ width: 218, height: 218, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
        <CameraSurface active={h.cameraActive} permission={h.permission.permission} checking={h.permission.checking} facing="back" torch={false}
          barcodeTypes={['qr', 'datamatrix']} sessionKey="material-sequence-quick" isCurrent={h.cameraCurrent}
          onDetection={event => { void h.scan(event.raw || event.data); }} onMountError={h.cameraFailed} onReady={h.cameraReady}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        {unavailable && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>{p('worker.scanner.unavailable')}</Text></View>}
        {!unavailable && !h.ready && <ActivityIndicator color="white" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />}
        {!unavailable && <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          {[33.33, 66.66].map(value => <View key={`v${value}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${value}%`, width: 1, backgroundColor: '#ffffff80' }} />)}
          {[33.33, 66.66].map(value => <View key={`h${value}`} style={{ position: 'absolute', left: 0, right: 0, top: `${value}%`, height: 1, backgroundColor: '#ffffff80' }} />)}
        </View>}
        {!unavailable && <View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, bottom: 12, backgroundColor: '#000a', borderRadius: 18, padding: 10 }}>
          <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>{processing ? p('worker.scanner.checking') : status}</Text></View>}
      </View>
      <Host matchContents style={{ position: 'absolute', right: 8, bottom: 8 }}><Button
        label={p(h.manualVisible ? 'worker.scanner.manual.hide' : 'worker.scanner.manual.show')}
        systemImage={h.manualVisible ? 'xmark' : 'pencil'} onPress={h.toggleManual}
        modifiers={[buttonStyle('borderedProminent'), accessibilityLabel(p(h.manualVisible ? 'worker.scanner.manual.hide' : 'worker.scanner.manual.show'))]} />
      </Host>
    </View>
    {h.manualVisible && <Host matchContents={{ vertical: true }} style={{ padding: 12 }}><HStack spacing={10}>
      <TextField text={input} placeholder={p('worker.scanner.manual.label')} onTextChange={h.setManual}
        modifiers={[disabled(processing), submitLabel('done'), onSubmit(() => { void h.submitManual(); }), frame({ maxWidth: Infinity })]} />
      <Button label={p('worker.scanner.accept')} systemImage="checkmark" onPress={() => { void h.submitManual(); }}
        modifiers={[buttonStyle('borderedProminent'), disabled(processing)]} />
    </HStack></Host>}
  </View>;
}
