import { Button, Host, HStack, Text as SwiftText, TextField, useNativeState } from '@expo/ui/swift-ui';
import { autocorrectionDisabled, onSubmit, submitLabel } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, PlatformColor, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkerOrderText } from '../components/useWorkerOrderText';
import { RezkaScannerPreview } from '../rezka/RezkaScannerPreview';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';

/** @v2 RawMaterialScanDialog: camera and manual input return one raw material barcode. */
export function MetalayzerScanner({ visible, isCurrent, finish }: {
  visible: boolean; isCurrent: () => boolean; finish: (value: string | null) => void;
}) {
  const [manual, setManual] = useState('');
  const { p } = useWorkerOrderText();
  const input = useNativeState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const finished = useRef(false);
  useEffect(() => { const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove(); }, []);
  const complete = (value: string) => {
    const barcode = rawMaterialBarcodeFromQr(value);
    if (finished.current || !isCurrent() || !barcode) return;
    finished.current = true; finish(barcode);
  };
  const close = () => { if (finished.current) return; finished.current = true; finish(null); };
  // The modifier registers a callback; the ref is read only when the user submits.
  // eslint-disable-next-line react-hooks/refs
  const submit = onSubmit(() => complete(manual));
  return <Modal visible={visible} presentationStyle="fullScreen" animationType="slide" onRequestClose={close}>
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Host style={[styles.header, { backgroundColor: PlatformColor('systemBackground') }]}><HStack spacing={14}>
        <Button label="Orqaga" systemImage="chevron.left" onPress={close} />
        <SwiftText>Xomashyoni skan qiling</SwiftText>
      </HStack></Host>
      <View style={styles.camera}>
        <RezkaScannerPreview active={visible && active} generation={0}
          isCurrent={() => visible && !finished.current && isCurrent()} accept={complete} />
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.frame}>
            <View style={[styles.vertical, { left: '33.33%' }]} /><View style={[styles.vertical, { left: '66.66%' }]} />
            <View style={[styles.horizontal, { top: '33.33%' }]} /><View style={[styles.horizontal, { top: '66.66%' }]} />
          </View>
          <Text style={styles.guide}>{p('worker.scanner.guide')}</Text>
        </View>
      </View>
      <Host style={[styles.manual, { backgroundColor: PlatformColor('systemBackground') }]}><HStack spacing={10}>
        <TextField text={input} placeholder={p('worker.material.scanner.manual')} onTextChange={setManual}
          modifiers={[autocorrectionDisabled(), submitLabel('done'), submit]} />
        <Button label="OK" systemImage="checkmark" onPress={() => complete(manual)} />
      </HStack></Host>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#000000' }, header: { height: 54 },
  camera: { flex: 1 }, overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 260, borderRadius: 24, borderWidth: 2, borderColor: '#ffffff' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff80' },
  horizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#ffffff80' },
  guide: { position: 'absolute', bottom: '12%', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 8, color: '#ffffff', backgroundColor: '#00000099', textAlign: 'center', fontWeight: '700' },
  manual: { height: 76, paddingHorizontal: 16 } });
