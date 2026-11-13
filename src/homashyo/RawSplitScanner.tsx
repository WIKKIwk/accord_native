import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { WorkerQrScannerView } from '../components/WorkerQrScannerView';
import { useWorkerOrderText } from '../components/useWorkerOrderText';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { useRawSplitScanner, type RawSplitScanSource } from './useRawSplitScanner';

type Props = { visible: boolean; active: boolean; isCurrent: () => boolean; onClose: () => void;
  onComplete: (barcode: string, source: RawSplitScanSource) => boolean | void };

export function RawSplitScanner({ visible, ...props }: Props) {
  return visible ? <ScannerSession {...props} /> : null;
}

function ScannerSession({ active, isCurrent, onClose, onComplete }: Omit<Props, 'visible'>) {
  const { p, t } = useWorkerOrderText();
  const [closing, setClosing] = useState(false), [manualOpen, setManualOpen] = useState(false), [manualBlocked, setManualBlocked] = useState(false);
  const [ready, setReady] = useState(false), [torch, setTorch] = useState(false), [generation, setGeneration] = useState(0);
  const mounted = useRef(true), closingRef = useRef(false), delivered = useRef(false), cameraFailed = useRef(false);
  const manualLock = useRef(false), pendingManual = useRef<string | null>(null);
  const pending = useRef<(() => boolean | void) | null>(null);
  function beginClose() {
    if (closingRef.current) return;
    closingRef.current = true; pendingManual.current = null; setTorch(false); setReady(false); setClosing(true);
  }
  const scan = useRawSplitScanner(active && !closing, isCurrent, (barcode, source) => {
    if (closingRef.current || !isSynchronouslyTrue(isCurrent)) return;
    const finish = onComplete;
    pending.current = () => finish(barcode, source);
    beginClose();
  });

  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') { setTorch(false); setReady(false); } });
    return () => { mounted.current = false; listener.remove(); };
  }, []);
  const ownerCurrent = () => mounted.current && active && !closingRef.current && isSynchronouslyTrue(isCurrent);
  const cameraCurrent = () => ownerCurrent() && !manualLock.current && !cameraFailed.current && isSynchronouslyTrue(scan.canUseCamera);
  function close() {
    if (closingRef.current) return;
    pending.current = null; beginClose();
  }
  function dismissed() {
    if (!mounted.current || delivered.current) return;
    delivered.current = true;
    const finish = pending.current; pending.current = null;
    if (!finish || finish() === false) onClose();
  }
  function manualDismissed() {
    if (!mounted.current || !manualLock.current) return;
    manualLock.current = false; setManualBlocked(false);
    const value = pendingManual.current; pendingManual.current = null;
    setGeneration(current => current + 1);
    if (value !== null && ownerCurrent()) scan.complete(value, 'manual');
  }
  function openManual() {
    if (!ownerCurrent() || manualLock.current) return;
    manualLock.current = true; setManualBlocked(true); setTorch(false); setReady(false); setManualOpen(true);
  }
  function cancelManual() {
    pendingManual.current = null; setManualOpen(false);
    if (Platform.OS !== 'ios') manualDismissed();
  }
  function confirmManual() {
    if (!ownerCurrent() || !manualLock.current || !scan.manual.trim()) return;
    pendingManual.current = scan.manual; setManualOpen(false);
    if (Platform.OS !== 'ios') manualDismissed();
  }
  async function retry() {
    if (!ownerCurrent()) return;
    cameraFailed.current = false; setTorch(false); setReady(false); setGeneration(value => value + 1);
    await scan.retry();
  }
  const unavailable = scan.failed || (!!scan.permission && !scan.permission.granted);
  const model = {
    closing, busy: false, error: '', manualOpen, manual: scan.manual, setManual: scan.setManual,
    close, dismissed, openManual, cancelManual, confirmManual, manualDismissed, clearError: () => {},
    labels: { title: scan.title, close: p('worker.action.close'), manual: p('worker.scanner.manual.title'),
      cancel: t('Bekor qilish'), verify: p('worker.scanner.manual.verify'), payload: scan.manualLabel,
      retry: p('worker.action.retry'), guidance: p('worker.qr.guidance.title'),
      flash: t(torch ? 'Flash o‘chirish' : 'Flash yoqish'), status: unavailable ? scan.unavailable : scan.guide },
    camera: { active: active && !closing && !manualBlocked && !unavailable, permission: scan.permission, torch, ready,
      unavailable, generation, current: cameraCurrent,
      onReady: () => { if (cameraCurrent()) setReady(true); },
      onError: () => { if (cameraCurrent()) { cameraFailed.current = true; setReady(false); setTorch(false); scan.cameraFailed(); } },
      retry, scan: (value: string, raw?: string) => { if (cameraCurrent()) scan.complete(raw ?? value, 'camera'); },
      toggleTorch: () => { if (cameraCurrent() && ready) setTorch(value => !value); } },
  };
  return <WorkerQrScannerView model={model} />;
}
