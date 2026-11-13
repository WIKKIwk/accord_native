import { Host, OutlinedTextField, Text as ComposeText, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useRawSplitScanner } from '../homashyo/useRawSplitScanner';
import { CameraSurface } from '../shared/camera/CameraSurface';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';

// @v2 RawMaterialScanDialog
export function MetalayzerScanner({ visible, isCurrent, onClose, onComplete }: { visible: boolean; isCurrent: () => boolean;
  onClose: () => void; onComplete: (barcode: string) => void }) {
  return visible ? <ScannerSession isCurrent={isCurrent} onClose={onClose} onComplete={onComplete} /> : null;
}
function ScannerSession({ isCurrent, onClose, onComplete }: { isCurrent: () => boolean; onClose: () => void; onComplete: (barcode: string) => void }) {
  const insets = useSafeAreaInsets(), colors = useMaterialColors();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [generation, setGeneration] = useState(0), mounted = useRef(true), done = useRef(false);
  const current = () => mounted.current && !done.current && AppState.currentState === 'active' && isCurrent();
  const scanner = useRawSplitScanner(foreground, current, value => { if (!current()) return; done.current = true; onComplete(value); });
  const manual = useNativeState(scanner.manual);
  useEffect(() => { mounted.current = true; const listener = AppState.addEventListener('change', value => { setForeground(value === 'active'); if (value === 'active') setGeneration(v => v + 1); });
    return () => { mounted.current = false; listener.remove(); }; }, []);
  useEffect(() => { if (manual.get() !== scanner.manual) manual.set(scanner.manual); }, [manual, scanner.manual]);
  const unavailable = scanner.failed || (!!scanner.permission && !scanner.permission.granted);
  const cameraCurrent = () => current() && scanner.canUseCamera();
  const close = () => { if (done.current) return; done.current = true; onClose(); };
  return <Modal visible animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surface }}>
      <RoleHeader title="Xomashyoni skan qiling" navigation={{ icon: 'back', label: 'Orqaga', onPress: close }} />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraSurface active={foreground && !unavailable} permission={scanner.permission} checking={scanner.checking} isCurrent={cameraCurrent}
          facing="back" torch={false} barcodeTypes={['qr', 'datamatrix']} sessionKey={`metalayzer:${generation}`} style={StyleSheet.absoluteFill}
          onDetection={event => scanner.complete(event.raw ?? event.data, 'camera')} onMountError={() => scanner.cameraFailed()} />
        {unavailable ? <View style={styles.center}><Text style={{ color: 'white' }}>{scanner.unavailable}</Text></View> :
          <View pointerEvents="none" style={styles.center}><View style={styles.frame} />
            <Text style={styles.guide}>{scanner.guide}</Text></View>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderColor: colors.outlineVariant }}>
        <View style={{ flex: 1 }}><Host matchContents={{ vertical: true }}><OutlinedTextField value={manual} onValueChange={scanner.setManual} singleLine
          keyboardOptions={{ imeAction: 'done' }} keyboardActions={{ onDone: () => scanner.complete(scanner.manual, 'manual') }} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label><ComposeText>{scanner.manualLabel}</ComposeText></OutlinedTextField.Label></OutlinedTextField></Host></View>
        <View style={{ width: 92 }}><WorkerSheetButton label="OK" variant="filled" icon={{ android: 'check' }} onPress={() => scanner.complete(scanner.manual, 'manual')} /></View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 260, borderColor: '#fff', borderWidth: 2, borderRadius: 20 },
  guide: { position: 'absolute', bottom: '12%', color: '#fff', backgroundColor: '#0009', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontWeight: '700' } });
