import { CameraView, type BarcodeScanningResult, type BarcodeType, type CameraMountError, type CameraType,
  type PermissionResponse } from 'expo-camera';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { CameraSurfaceGate } from './CameraSurfaceGate';

export type CameraSurfaceProps = {
  active: boolean;
  permission: PermissionResponse | null;
  facing: CameraType;
  torch: boolean;
  barcodeTypes: BarcodeType[];
  /** Change to force a new native camera generation when a role retries. */
  sessionKey: string;
  style?: StyleProp<ViewStyle>;
  onDetection(event: BarcodeScanningResult): void;
  onMountError(event: CameraMountError): void;
  onReady?(): void;
};

/** Permission requests, UI, parser, deduplication and navigation belong to the caller. */
export function CameraSurface({ active, permission, facing, torch, barcodeTypes, sessionKey, style,
  onDetection, onMountError, onReady }: CameraSurfaceProps) {
  const enabled = active && permission?.granted === true;
  const token = useMemo(() => ({ enabled, sessionKey }), [enabled, sessionKey]);
  const gate = useMemo(() => new CameraSurfaceGate(), []), callbacks = useRef({ onDetection, onMountError, onReady });
  useLayoutEffect(() => { callbacks.current = { onDetection, onMountError, onReady }; }, [onDetection, onMountError, onReady]);
  useLayoutEffect(() => {
    if (enabled) gate.activate(token);
    return () => gate.deactivate(token);
  }, [enabled, token, gate]);
  if (!enabled) return null;
  return <CameraView key={sessionKey} style={style} facing={facing} enableTorch={torch} barcodeScannerSettings={{ barcodeTypes }}
    onBarcodeScanned={event => gate.deliver(token, event, callbacks.current.onDetection)}
    onMountError={event => gate.deliver(token, event, callbacks.current.onMountError)}
    onCameraReady={() => gate.deliver(token, undefined, () => callbacks.current.onReady?.())} />;
}
