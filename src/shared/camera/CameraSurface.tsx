import { CameraView, type BarcodeScanningResult, type BarcodeType, type CameraMountError, type CameraType,
  type PermissionResponse } from 'expo-camera';
import { useLayoutEffect, useMemo, useRef, type Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { CameraSurfaceGate } from './CameraSurfaceGate';
import { isSynchronouslyTrue } from './synchronousGuard';

export type CameraSurfaceProps = {
  active: boolean;
  permission: PermissionResponse | null;
  checking: boolean;
  facing: CameraType;
  torch: boolean;
  barcodeTypes: BarcodeType[];
  /** Change to force a new native camera generation when a role retries or its detection policy changes. */
  sessionKey: string;
  /** Pure synchronous read of live role focus/app/session state and permission controller canUseCamera(). */
  isCurrent(): boolean;
  style?: StyleProp<ViewStyle>;
  cameraRef?: Ref<CameraView>;
  onDetection(event: BarcodeScanningResult): void;
  onMountError(event: CameraMountError): void;
  onReady?(): void;
};

/** Permission requests, UI, parser, deduplication and navigation belong to the caller. */
export function CameraSurface({ active, permission, checking, facing, torch, barcodeTypes, sessionKey, style, cameraRef,
  isCurrent, onDetection, onMountError, onReady }: CameraSurfaceProps) {
  const enabled = active && checking === false && permission?.granted === true;
  const configKey = JSON.stringify([sessionKey, facing, barcodeTypes]);
  const token = useMemo(() => ({ enabled, configKey }), [enabled, configKey]);
  const gate = useMemo(() => new CameraSurfaceGate(), []), callbacks = useRef({ isCurrent, onDetection, onMountError, onReady });
  useLayoutEffect(() => { callbacks.current = { isCurrent, onDetection, onMountError, onReady }; }, [isCurrent, onDetection, onMountError, onReady]);
  useLayoutEffect(() => {
    if (enabled) gate.activate(token);
    return () => gate.deactivate(token);
  }, [enabled, token, gate]);
  if (!enabled) return null;
  const deliver = <T,>(value: T, receive: (snapshot: typeof callbacks.current, event: T) => void) => {
    gate.deliver(token, value, event => {
      const snapshot = callbacks.current;
      if (!isSynchronouslyTrue(snapshot.isCurrent) || callbacks.current !== snapshot) return;
      // The guard can reenter React and commit a new generation. Recheck after it returns.
      gate.deliver(token, event, accepted => receive(snapshot, accepted));
    });
  };
  return <CameraView key={configKey} ref={cameraRef} style={style} facing={facing} enableTorch={torch} barcodeScannerSettings={{ barcodeTypes }}
    onBarcodeScanned={event => deliver(event, (snapshot, value) => snapshot.onDetection(value))}
    onMountError={event => deliver(event, (snapshot, value) => snapshot.onMountError(value))}
    onCameraReady={() => deliver(undefined, snapshot => snapshot.onReady?.())} />;
}
