import { useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { workerQrPayload } from '../workerQr';
import type { Apparatus } from '../workerApi';
import { prepareWorkerFabQr, WorkerFabGuidance, workerFabErrorText } from '../workerFabQr';
import { workerFabQrReads } from '../workerFabQrReads';
import { useWorkerOrderText } from './useWorkerOrderText';

export type WorkerQrScannerProps = { session: Session; apparatusId: string; apparatus?: Apparatus;
  getSnapshot: () => Record<string, any> | null; apparatusLabel: (id: string) => string; onClose: () => void;
  current?: () => boolean;
  onOrder: (apparatusId: string, orderId: string, qr: string, switching?: boolean) => void };
type PendingOrder = { orderId: string; qr: string; switching: boolean; scope: string; witness: SessionWitness | null };

/** Shared lookup and camera owner; the native sheet delivers a result only after dismissal. */
export function useWorkerQrScanner({ session, apparatusId, apparatus, getSnapshot, apparatusLabel, onClose, onOrder, current: parentCurrent }: WorkerQrScannerProps) {
  const { p, t } = useWorkerOrderText();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false), [manual, setManual] = useState('');
  const [closing, setClosing] = useState(false), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [cameraFailure, setCameraFailure] = useState(false), [cameraReady, setCameraReady] = useState(false);
  const [cameraGeneration, setCameraGeneration] = useState(0), [torch, setTorch] = useState(false);
  const active = useRef(true), mounted = useRef(true), scanLock = useRef(false), manualLock = useRef(false);
  const appActive = useRef(AppState.currentState === 'active'), cameraFailed = useRef(false), permissionRequested = useRef(false);
  const request = useRef<AbortController | null>(null), delivered = useRef(false);
  const pendingOrder = useRef<PendingOrder | null>(null);
  const pendingManual = useRef<{ qr: string; witness: SessionWitness | null } | null>(null);
  const scope = sessionReadScope(session);
  const witness = useRef(captureSessionWitness(session));
  const ownerWindow = useRef(parentCurrent);
  const ownerCurrent = () => mounted.current && !!activeSessionToken(session) && isSessionWitnessCurrent(witness.current) && scope === sessionReadScope(session) && ownerWindow.current?.() !== false;

  useEffect(() => {
    mounted.current = true; active.current = true;
    const listener = AppState.addEventListener('change', state => {
      appActive.current = state === 'active'; setForeground(appActive.current);
      if (!appActive.current) { request.current?.abort(); setTorch(false); setCameraReady(false); }
    });
    return () => { mounted.current = false; active.current = false; request.current?.abort(); listener.remove(); };
  }, []);
  useEffect(() => {
    if (!permission || permission.status !== 'undetermined' || permissionRequested.current || !active.current || !appActive.current || !ownerCurrent()) return;
    permissionRequested.current = true;
    void requestPermission().catch(() => { if (active.current && mounted.current) setCameraFailure(true); });
  });

  function beginClose() {
    if (!active.current) return;
    active.current = false; request.current?.abort(); pendingManual.current = null;
    setTorch(false); setClosing(true);
  }
  function close() { if (!active.current) return; pendingOrder.current = null; beginClose(); }
  function dismissed() {
    if (delivered.current || !mounted.current) return;
    delivered.current = true;
    beginClose();
    const pending = pendingOrder.current; pendingOrder.current = null;
    if (pending && ownerCurrent() && appActive.current && pending.scope === sessionReadScope(session) && isSessionWitnessCurrent(pending.witness))
      onOrder(apparatusId, pending.orderId, pending.qr, pending.switching);
    else onClose();
  }
  async function scan(raw: string) {
    const qr = workerQrPayload(raw);
    if (!qr || !active.current || !appActive.current || !ownerCurrent() || scanLock.current || manualLock.current) return;
    scanLock.current = true; setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    const current = () => active.current && appActive.current && ownerCurrent() && !controller.signal.aborted;
    const reads = workerFabQrReads(session, apparatusId, getSnapshot, current);
    try {
      if (!apparatus) throw new WorkerFabGuidance(p('worker.qr.select_apparatus'));
      const target = await prepareWorkerFabQr(session, apparatus, qr, reads, p, apparatusLabel);
      if (reads.current()) {
        pendingOrder.current = { orderId: target.orderId, qr, switching: target.switching, scope, witness: captureSessionWitness(session) };
        beginClose();
      }
    } catch (failure) { if (reads.current()) { setCameraReady(false); setError(workerFabErrorText(failure, p)); } }
    finally {
      request.current = null; scanLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function manualDismissed() {
    manualLock.current = false;
    const pending = pendingManual.current; pendingManual.current = null;
    if (pending && active.current && isSessionWitnessCurrent(pending.witness)) void scan(pending.qr);
  }
  function openManual() {
    if (!active.current || scanLock.current || !ownerCurrent()) return;
    manualLock.current = true; setTorch(false); setCameraReady(false); setManualOpen(true);
  }
  function cancelManual() {
    pendingManual.current = null; setManualOpen(false);
    if (Platform.OS !== 'ios') manualDismissed();
  }
  function confirmManual() {
    const qr = workerQrPayload(manual);
    if (!qr || !active.current || scanLock.current || !ownerCurrent()) return;
    pendingManual.current = { qr, witness: captureSessionWitness(session) };
    setManualOpen(false);
    if (Platform.OS !== 'ios') manualDismissed();
  }
  async function retryCamera() {
    if (!active.current || !ownerCurrent()) return;
    cameraFailed.current = false; setCameraFailure(false); setCameraReady(false); setTorch(false);
    setCameraGeneration(value => value + 1);
    if (!permission?.granted) {
      try { await requestPermission(); }
      catch { if (active.current && mounted.current) setCameraFailure(true); }
    }
  }
  const cameraEnabled = !closing && foreground && !!permission?.granted && !cameraFailure && !manualOpen && !error;
  const cameraCurrent = () => active.current && appActive.current && !manualLock.current && !cameraFailed.current && ownerCurrent();
  const onCameraReady = useCallback(() => { if (active.current && mounted.current) setCameraReady(true); }, []);
  const onCameraError = useCallback(() => {
    cameraFailed.current = true;
    if (active.current && mounted.current) { setCameraFailure(true); setCameraReady(false); setTorch(false); }
  }, []);
  const cameraUnavailable = cameraFailure || (!!permission && !permission.granted);
  return {
    closing, busy, error, manualOpen, manual, setManual, close, dismissed, openManual, cancelManual, confirmManual, manualDismissed,
    clearError: () => setError(''),
    labels: { title: p('worker.action.scan'), close: p('worker.action.close'), manual: p('worker.scanner.manual.title'),
      cancel: t('Bekor qilish'), verify: p('worker.scanner.manual.verify'), payload: p('worker.scanner.manual.payload'),
      retry: p('worker.action.retry'), guidance: p('worker.qr.guidance.title'),
      flash: t(torch ? 'Flash o‘chirish' : 'Flash yoqish'),
      status: busy ? p('worker.scanner.lookup') : cameraUnavailable ? p('worker.scanner.camera_permission') : p('worker.scanner.progress_prompt') },
    camera: { active: cameraEnabled, permission, torch, ready: cameraReady, unavailable: cameraUnavailable, generation: cameraGeneration,
      current: cameraCurrent, onReady: onCameraReady, onError: onCameraError, retry: retryCamera,
      scan: (value: string) => { void scan(value); },
      toggleTorch: () => { if (cameraCurrent() && cameraReady) setTorch(value => !value); } },
  };
}
export type WorkerQrScannerModel = ReturnType<typeof useWorkerQrScanner>;
