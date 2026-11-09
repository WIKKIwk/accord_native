import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraSurface } from '../shared/camera/CameraSurface';
import type { useQolipQrScanner } from './useQolipQrScanner';

export function qolipScannerFrame(width: number, height: number) {
  return { width: Math.max(220, Math.min(320, width * 0.78)), height: Math.max(220, Math.min(340, height * 0.42)) };
}

/** Camera/overlay shared content; each platform supplies its own native controls. */
export function QolipQrScannerPreview({ scan, error, status, torch }: { scan: ReturnType<typeof useQolipQrScanner>;
  error: ReactNode; status: ReactNode; torch: ReactNode }) {
  const insets = useSafeAreaInsets(), { camera } = scan;
  return <View style={styles.root}>
    <CameraSurface active={scan.active && camera.requested && !scan.state.finished} permission={camera.permission} checking={camera.checking}
      cameraRef={camera.cameraRef} isCurrent={camera.canUseCamera} facing="back" torch={camera.torch}
      barcodeTypes={['qr', 'datamatrix']} sessionKey={`qolip:${camera.generation}`} style={StyleSheet.absoluteFill}
      onReady={() => camera.onReady(camera.generation)} onMountError={() => camera.onMountError(camera.generation)}
      onDetection={event => scan.detect(event.raw, event.data, scan.state.generation)} />
    {camera.failure ? <View style={styles.fallback}>{error}</View> : !camera.ready && !scan.state.processing && !scan.state.finished
      ? <View pointerEvents="none" style={styles.fallback}><ActivityIndicator color="#ffffff" /></View> : null}
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={{ height: 68 }} />
      <View pointerEvents="box-none" style={styles.frameArea}>
        <Frame torch={camera.ready && !camera.failure && camera.requested ? torch : null} />
      </View>
      <View pointerEvents="none" style={styles.status}>{status}</View>
    </View>
  </View>;
}

function Frame({ torch }: { torch: ReactNode }) {
  const [size, setSize] = useState({ width: 220, height: 220 });
  return <View pointerEvents="box-none" style={styles.measure} onLayout={event => {
    const layout = event.nativeEvent.layout;
    setSize(qolipScannerFrame(layout.width, layout.height));
  }}><View pointerEvents="box-none" style={[styles.frame, size]}>
    <View pointerEvents="none" style={styles.point} />
    <View style={styles.torch}>{torch}</View>
  </View></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#000000' },
  fallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay: { paddingTop: 18, paddingHorizontal: 18 }, frameArea: { flex: 1 },
  measure: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: 30, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.88)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  point: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.78)' },
  torch: { position: 'absolute', top: 12, end: 12 },
  status: { alignSelf: 'center', marginTop: 18, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.14)' } });
