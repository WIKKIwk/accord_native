import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RawSplitScanGate } from './rawSplitScanLogic';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
export function useRawSplitScanner(onComplete: (barcode: string) => void) {
  const [permission, requestPermission] = useCameraPermissions(), [failed, setFailed] = useState(false), [manual, setManual] = useState('');
  const gate = useRef(new RawSplitScanGate()), requested = useRef(false);
  const locale = useSyncExternalStore(subscribe, localeSnapshot, localeSnapshot);
  useEffect(() => {
    if (requested.current || permission?.granted) return;
    requested.current = true; let active = true;
    void requestPermission().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [permission?.granted, requestPermission]);
  const complete = useCallback((raw: string) => {
    const barcode = gate.current.accept(raw); if (barcode !== null) onComplete(barcode);
  }, [onComplete]);
  return { permission, failed, manual, setManual, complete, cameraFailed: () => setFailed(true),
    title: productionText('worker.material.scanner.title', locale), manualLabel: productionText('worker.material.scanner.manual', locale),
    unavailable: productionText('worker.scanner.unavailable', locale), guide: productionText('worker.scanner.guide', locale) };
}
