import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useCameraSurfacePermission } from '../shared/camera/useCameraSurfacePermission';

/** @v2 _ProductionQuickScannerPanelState: serial continuous detection and manual submission. */
export function useMaterialQuickScanner(busy: boolean, isCurrent: () => boolean, detect: (raw: string) => Promise<void>) {
  const permission = useCameraSurfacePermission(), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [processing, setProcessing] = useState(false), [failed, setFailed] = useState(false), [ready, setReady] = useState(false);
  const [manualVisible, setManualVisible] = useState(false), [manual, setManual] = useState('');
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => {
    alive.current = true; const listener = AppState.addEventListener('change', value => {
      setForeground(value === 'active'); if (value !== 'active') setReady(false);
    });
    return () => { alive.current = false; listener.remove(); };
  }, []);
  const request = permission.requestPermission;
  useEffect(() => { if (foreground && isCurrent()) void request(); }, [foreground, isCurrent, request]);
  const current = () => alive.current && foreground && AppState.currentState === 'active' && isCurrent();
  const submit = async (raw: string, camera: boolean) => {
    const value = raw.trim();
    if (!current() || lock.current || busy || !value) return;
    lock.current = true; setProcessing(true);
    if (camera) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try { await detect(value); if (!camera && current()) setManual(''); }
    finally { lock.current = false; if (alive.current) setProcessing(false); }
  };
  return { permission, processing, failed, ready, manualVisible, manual, setManual,
    toggleManual: () => { if (current()) setManualVisible(value => !value); },
    submitManual: () => submit(manual, false), scan: (raw: string) => submit(raw, true),
    cameraCurrent: () => current() && !failed && permission.canUseCamera(),
    cameraActive: foreground && isCurrent() && !failed,
    cameraFailed: () => { if (current()) setFailed(true); },
    cameraReady: () => { if (current()) setReady(true); },
  };
}
