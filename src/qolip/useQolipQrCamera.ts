import type { CameraView } from 'expo-camera';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useCameraSurfacePermission } from '../shared/camera/useCameraSurfacePermission';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

type PendingStart = { revision: number; finish(started: boolean): void; timer: ReturnType<typeof setTimeout> };

/** Native camera adapter for the Qolip scanner's stop/retry contract. */
export function useQolipQrCamera(active: boolean, isCurrent: () => boolean) {
  const permission = useCameraSurfacePermission(), { refreshPermission, requestPermission, canUseCamera } = permission;
  const cameraRef = useRef<CameraView | null>(null);
  const live = useRef(active), mounted = useRef(true), revision = useRef(0), pending = useRef<PendingStart | null>(null);
  const failed = useRef(false), [failure, setFailure] = useState(false), [requested, setRequested] = useState(false);
  const [generation, setGeneration] = useState(0), [ready, setReady] = useState(false), [torch, setTorch] = useState(false);
  const finish = useCallback((started: boolean) => {
    const operation = pending.current; pending.current = null;
    if (operation) { clearTimeout(operation.timer); operation.finish(started); }
  }, []);
  const stop = useCallback(async () => {
    revision.current++; finish(false);
    const camera = cameraRef.current;
    if (mounted.current) { setRequested(false); setReady(false); setTorch(false); }
    // ReliableScannerSession bounds native release to four seconds.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (camera) await Promise.race([camera.pausePreview(), new Promise<void>(resolve => { timer = setTimeout(resolve, 4_000); })]);
    } catch { /* The native view may already have been removed. */ }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }, [finish]);
  useLayoutEffect(() => {
    live.current = active;
    if (!active) void stop();
  }, [active, stop]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; live.current = false; void stop(); };
  }, [stop]);
  const current = useCallback(() => mounted.current && live.current && isSynchronouslyTrue(isCurrent), [isCurrent]);
  const restart = useCallback(async (): Promise<boolean> => {
    if (!current()) return false;
    const attempt = ++revision.current; finish(false);
    failed.current = false; setFailure(false); setReady(false); setRequested(false); setTorch(false);
    // The source's eight-second start limit includes permission and native startup.
    const started = new Promise<boolean>(resolve => {
      const timer = setTimeout(() => {
        if (attempt !== revision.current) return;
        revision.current++;
        if (current()) { failed.current = true; setFailure(true); setRequested(false); }
        finish(false);
      }, 8_000);
      pending.current = { revision: attempt, timer, finish: resolve };
    });
    void (async () => {
      try {
        let granted = await refreshPermission();
        if (!current() || attempt !== revision.current) { if (attempt === revision.current) finish(false); return; }
        if (!granted.granted && granted.canAskAgain) granted = await requestPermission();
        if (!current() || attempt !== revision.current) { if (attempt === revision.current) finish(false); return; }
        if (!granted.granted) { failed.current = true; setFailure(true); finish(false); return; }
        setGeneration(attempt); setRequested(true);
      } catch {
        if (attempt === revision.current) {
          if (current()) { failed.current = true; setFailure(true); }
          finish(false);
        }
      }
    })();
    return started;
  }, [current, finish, refreshPermission, requestPermission]);
  const onReady = useCallback((attempt: number) => {
    if (!current() || attempt !== revision.current || pending.current?.revision !== attempt) return;
    setReady(true); finish(true);
  }, [current, finish]);
  const onMountError = useCallback((attempt: number) => {
    if (!current() || attempt !== revision.current) return;
    failed.current = true; setFailure(true); setReady(false); setRequested(false); finish(false);
  }, [current, finish]);
  const toggleTorch = useCallback(() => {
    if (current() && ready && !failed.current && canUseCamera()) setTorch(value => !value);
  }, [current, ready, canUseCamera]);
  return { ...permission, cameraRef, requested: active && requested, generation, ready, failure, torch,
    restart, stop, onReady, onMountError, toggleTorch, cameraFailed: () => failed.current,
    canUseCamera: () => current() && !failed.current && canUseCamera() };
}
