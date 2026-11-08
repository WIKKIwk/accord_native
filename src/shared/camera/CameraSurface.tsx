import { CameraView, type BarcodeScanningResult, type BarcodeType, type CameraMountError, type CameraType,
  type PermissionResponse } from 'expo-camera';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { CameraSurfaceGate } from './CameraSurfaceGate';

export type CameraSurfaceProps = {
  active: boolean;
  permission: PermissionResponse | null;
  checking: boolean;
  facing: CameraType;
  torch: boolean;
  barcodeTypes: BarcodeType[];
  /** Change to force a new native camera generation when a role retries or its detection policy changes. */
  sessionKey: string;
  /** Must synchronously check role focus/app/session state and permission controller canUseCamera(). */
  isCurrent(): boolean;
  style?: StyleProp<ViewStyle>;
  onDetection(event: BarcodeScanningResult): void;
  onMountError(event: CameraMountError): void;
  onReady?(): void;
};

/** Permission requests, UI, parser, deduplication and navigation belong to the caller. */
export function CameraSurface({ active, permission, checking, facing, torch, barcodeTypes, sessionKey, style,
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
  const current = () => { try { return callbacks.current.isCurrent(); } catch { return false; } };
  return <CameraView key={configKey} style={style} facing={facing} enableTorch={torch} barcodeScannerSettings={{ barcodeTypes }}
    onBarcodeScanned={event => gate.deliver(token, event, value => { if (current()) callbacks.current.onDetection(value); })}
    onMountError={event => gate.deliver(token, event, value => { if (current()) callbacks.current.onMountError(value); })}
    onCameraReady={() => gate.deliver(token, undefined, () => { if (current()) callbacks.current.onReady?.(); })} />;
}
