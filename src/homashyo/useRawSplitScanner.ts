import { useCameraSurfacePermission } from '../shared/camera/useCameraSurfacePermission';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RawSplitScanGate } from './rawSplitScanLogic';

const subscribe = (listener: () => void) => localeController.addListener(listener);
const localeSnapshot = () => localeController.locale;
export function useRawSplitScanner(active: boolean, isCurrent: () => boolean, onComplete: (barcode: string) => void) {
  const { permission, checking, canUseCamera, requestPermission, error: permissionError } = useCameraSurfacePermission();
  const [failed, setFailed] = useState(false), [manual, setManual] = useState('');
  const gate = useRef(new RawSplitScanGate()), requested = useRef(false);
  const locale = useSyncExternalStore(subscribe, localeSnapshot, localeSnapshot);
  useEffect(() => {
    let current = false; try { current = isCurrent(); } catch { /* Owner is no longer current. */ }
    if (!active || !current || permissionError || permission === null || requested.current || permission.granted || !permission.canAskAgain) return;
    requested.current = true; let requestActive = true;
    void requestPermission().catch(() => { if (requestActive) setFailed(true); });
    return () => { requestActive = false; };
  }, [active, isCurrent, permission, permissionError, requestPermission]);
  const complete = useCallback((raw: string) => {
    try { if (!active || !isCurrent()) return; } catch { return; }
    const barcode = gate.current.accept(raw); if (barcode !== null) onComplete(barcode);
  }, [active, isCurrent, onComplete]);
  return { permission, checking, canUseCamera, failed: failed || (active && !!permissionError), manual, setManual, complete, cameraFailed: () => setFailed(true),
    title: productionText('worker.material.scanner.title', locale), manualLabel: productionText('worker.material.scanner.manual', locale),
    unavailable: productionText('worker.scanner.unavailable', locale), guide: productionText('worker.scanner.guide', locale) };
}
