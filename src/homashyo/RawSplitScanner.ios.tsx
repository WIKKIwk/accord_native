import { Host, Text as SwiftText, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame, onSubmit, submitLabel, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { CameraSurface } from '../shared/camera/CameraSurface';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { useEffect } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, PlatformColor, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useRawSplitScanner, type RawSplitScanSource } from './useRawSplitScanner';

export function RawSplitScanner({ visible, active, isCurrent, onClose, onComplete }: { visible: boolean; active: boolean; isCurrent: () => boolean; onClose: () => void; onComplete: (barcode: string, source: RawSplitScanSource) => void }) {
  return visible ? <ScannerSession active={active} isCurrent={isCurrent} onClose={onClose} onComplete={onComplete} /> : null;
}
function ScannerSession({ active, isCurrent, onClose, onComplete }: { active: boolean; isCurrent: () => boolean; onClose: () => void; onComplete: (barcode: string, source: RawSplitScanSource) => void }) {
  const scan = useRawSplitScanner(active, isCurrent, onComplete), input = useNativeState(''), insets = useSafeAreaInsets();
  useEffect(() => { if (input.get() !== scan.manual) input.set(scan.manual); }, [input, scan.manual]);
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { backgroundColor: PlatformColor('systemBackground'), paddingTop: insets.top }]}>
      <View style={styles.header}><WorkerIconButton icon="back" label="Orqaga" onPress={onClose} />
        <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><SwiftText>{scan.title}</SwiftText></Host></View>
      <View style={styles.preview}>
        {scan.permission?.granted && !scan.failed ? <CameraSurface active={active} permission={scan.permission} checking={scan.checking} isCurrent={() => isSynchronouslyTrue(isCurrent) && isSynchronouslyTrue(scan.canUseCamera)} style={StyleSheet.absoluteFill} facing="back" torch={false}
          barcodeTypes={['qr', 'datamatrix']} sessionKey="homashyo" onMountError={scan.cameraFailed}
          onDetection={event => scan.complete(event.raw ?? event.data, 'camera')} /> : scan.permission === null && !scan.failed ?
          <ActivityIndicator /> : <Text style={{ color: PlatformColor('label') }}>{scan.unavailable}</Text>}
        {scan.permission?.granted && !scan.failed && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={styles.guide}><View style={styles.verticalOne} /><View style={styles.verticalTwo} />
            <View style={styles.horizontalOne} /><View style={styles.horizontalTwo} /></View>
          <View style={styles.guideCaption}><Text style={styles.guideText}>{scan.guide}</Text></View>
        </View>}
      </View>
      <View style={[styles.manual, { paddingBottom: Math.max(insets.bottom, 16) }]}><Host matchContents={{ vertical: true }} style={{ flex: 1 }}>
        <VStack alignment="leading" spacing={3}><SwiftText>{scan.manualLabel}</SwiftText>
          <TextField text={input} onTextChange={scan.setManual}
            modifiers={[accessibilityLabel(scan.manualLabel), textFieldStyle('roundedBorder'), frame({ maxWidth: Infinity }), submitLabel('done'), onSubmit(() => scan.complete(scan.manual, 'manual'))]} />
        </VStack>
      </Host><View style={{ width: 92 }}><WorkerSheetButton label="OK" icon={{ ios: 'checkmark', android: 'check' }} variant="filled" onPress={() => scan.complete(scan.manual, 'manual')} /></View></View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  preview: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }, manual: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  guide: { width: 260, height: 260, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -130 },
  verticalOne: { position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.52)' },
  verticalTwo: { position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.52)' },
  horizontalOne: { position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.52)' },
  horizontalTwo: { position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.52)' },
  guideCaption: { position: 'absolute', alignSelf: 'center', bottom: '13%', borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 14, paddingVertical: 8 },
  guideText: { color: '#fff', fontWeight: '700', textAlign: 'center' } });
