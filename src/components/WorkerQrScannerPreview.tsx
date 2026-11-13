import type { ReactNode } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CameraSurface } from '../shared/camera/CameraSurface';
import type { WorkerQrScannerModel } from './useWorkerQrScanner';

type ScannerCamera = Omit<WorkerQrScannerModel['camera'], 'scan'> & { scan(value: string, raw?: string): void };
/** Only the camera and its framing are shared; sheet chrome and controls are native. */
export function WorkerQrScannerPreview({ camera, torch }: { camera: ScannerCamera; torch: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const previewHeight = Math.min(360, Math.round(height * 0.38));
  const frameSize = Math.min(260, Math.round(previewHeight * 0.76), Math.round((Math.min(width, 560) - 40) * 0.68));
  return <View style={[styles.preview, { height: previewHeight }]}>
    <CameraSurface active={camera.active} permission={camera.permission} checking={!camera.permission} isCurrent={camera.current}
      facing="back" torch={camera.torch} barcodeTypes={['qr', 'datamatrix']} sessionKey={`worker-fab:${camera.generation}`}
      style={StyleSheet.absoluteFill} onDetection={event => camera.scan(event.data, event.raw)} onMountError={camera.onError} onReady={camera.onReady} />
    {camera.active && !camera.unavailable && <View pointerEvents="none" style={styles.overlay}>
      <View style={[styles.frame, { width: frameSize, height: frameSize }]} />
      {!camera.ready && <ActivityIndicator color="#ffffff" size="large" style={styles.spinner} />}
    </View>}
    {camera.unavailable && <View pointerEvents="none" style={styles.overlay}><SymbolView name={{ ios: 'video.slash', android: 'videocam_off' }} size={44} tintColor="#ffffffb3" /></View>}
    {camera.ready && camera.active && <View style={styles.torch}>{torch}</View>}
  </View>;
}
const styles = StyleSheet.create({
  preview: { width: '100%', backgroundColor: '#000000', borderRadius: 24, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000018' },
  frame: { borderRadius: 28, borderWidth: 2, borderColor: '#ffffffe6', backgroundColor: '#ffffff08' },
  spinner: { position: 'absolute' },
  torch: { position: 'absolute', top: 12, right: 12 },
});
