import { useEffect, useRef, useState } from 'react';
import type { CameraMountError } from 'expo-camera';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { CameraSurface } from '../shared/camera/CameraSurface';
import { useCameraSurfacePermission } from '../shared/camera/useCameraSurfacePermission';

export type RezkaSplitScannerProps = { active: boolean; generation: number; isCurrent(): boolean; close(): void; accept(value: string): void };

/** Camera content shared by the two native full-screen dialogs, not a route or screen fallback. */
export function RezkaScannerPreview({ active, generation, isCurrent, accept }: Omit<RezkaSplitScannerProps, 'close'>) {
  const { permission, checking, error: permissionError, canUseCamera, requestPermission, refreshPermission } = useCameraSurfacePermission();
  const [failure, setFailure] = useState<CameraMountError | null>(null), failed = useRef<CameraMountError | null>(null);
  const requested = useRef(false), [attempted, setAttempted] = useState(false);
  const [activation, setActivation] = useState({ active, generation }), [permissionReady, setPermissionReady] = useState(false);
  // Adjust state before commit so an old grant cannot mount the camera for one frame on resume.
  if (activation.active !== active || activation.generation !== generation) {
    setActivation({ active, generation }); setPermissionReady(false);
    if (active) setFailure(null);
  }
  useEffect(() => {
    if (!active) return;
    let alive = true; failed.current = null;
    void refreshPermission().catch(() => {}).finally(() => { if (alive) setPermissionReady(true); });
    return () => { alive = false; };
  }, [active, generation, refreshPermission]);
  useEffect(() => {
    if (!active || !permissionReady || !isCurrent() || checking || permissionError || !permission || permission.granted ||
        !permission.canAskAgain || requested.current) return;
    requested.current = true;
    void requestPermission().catch(() => {}).finally(() => setAttempted(true));
  }, [active, permissionReady, isCurrent, checking, permissionError, permission, requestPermission]);
  const denied = permissionReady && !checking && permission && !permission.granted && (!permission.canAskAgain || attempted);
  const error = failure ?? permissionError;
  // These are mobile_scanner's actual default error words, not the unsupported-platform message.
  const message = denied ? 'Camera permission denied.' : error ? 'An unexpected error occurred.' : null;
  const detail = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : null;
  return <View style={styles.preview}>
      {permission?.granted && !failure && !permissionError
        ? <CameraSurface active={active && activation.active === active && activation.generation === generation && permissionReady} permission={permission} checking={checking}
          isCurrent={() => active && permissionReady && !failed.current && isCurrent() && canUseCamera()}
          facing="back" torch={false} barcodeTypes={['qr', 'datamatrix']} sessionKey={`rezka-split:${generation}`} style={StyleSheet.absoluteFill}
          onDetection={event => accept(event.raw ?? event.data)} onMountError={event => { failed.current = event; setFailure(event); }} />
        : message ? <View style={styles.error}>
          <SymbolView name={{ ios: 'exclamationmark.circle.fill', android: 'error' }} size={24} tintColor="#ffffff" />
          <Text style={styles.message}>{message}</Text>{detail ? <Text style={styles.message}>{detail}</Text> : null}</View> : null}
    </View>;
}
const styles = StyleSheet.create({ preview: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  error: { alignItems: 'center', gap: 16 }, message: { color: '#ffffff', textAlign: 'center' } });
