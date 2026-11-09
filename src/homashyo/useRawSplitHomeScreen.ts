import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { useRawSplitContext } from './RawSplitContext';

/** Whole-preview detections require an explicit barcode check until native scan-window parity exists. */
export function useRawSplitHomeScreen() {
  const { ticket, runtime, issueRevision } = useRawSplitContext(), [visible, setVisible] = useState(false);
  const focused = useRef(false), foreground = useRef(AppState.currentState === 'active'), open = useRef(false), generation = useRef(0);
  const lease = useRef<(() => boolean) | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const isOwnerCurrent = useCallback(() => focused.current && foreground.current && rawSplitSessionIsCurrent(ticket), [ticket]);
  const isScannerCurrent = useCallback(() => open.current && isOwnerCurrent() && lease.current?.() === true, [isOwnerCurrent]);
  useFocusEffect(useCallback(() => {
    focused.current = true; setCameraActive(open.current && foreground.current);
    return () => { generation.current++; focused.current = false; open.current = false; setVisible(false); setCameraActive(false); };
  }, []));
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => {
      foreground.current = value === 'active'; if (!foreground.current) generation.current++;
      setCameraActive(open.current && focused.current && foreground.current);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => runtime.home.subscribe(() => {
    if (open.current && lease.current && !lease.current()) {
      generation.current++; open.current = false; lease.current = null; setVisible(false); setCameraActive(false);
    }
  }), [runtime.home]);
  const hide = () => { open.current = false; lease.current = null; setCameraActive(false); setVisible(false); };
  const close = () => { generation.current++; hide(); };
  const scan = () => {
    if (!isOwnerCurrent()) return; const next = runtime.home.captureClearLease(); if (!next) return;
    generation.current++; lease.current = next; open.current = true; setVisible(true); setCameraActive(true);
  };
  const complete = (barcode: string) => {
    if (!isScannerCurrent()) return;
    const currentLease = lease.current!; const selection = ++generation.current; open.current = false; setCameraActive(false); runtime.home.setBarcode(barcode);
    const cancelSelection = () => { if (selection === generation.current) close(); };
    Alert.alert('Skanerlangan kod', barcode, [{ text: 'Bekor qilish', style: 'cancel', onPress: cancelSelection }, { text: 'Rulonni topish', onPress: () => {
      if (selection !== generation.current || !isOwnerCurrent() || !currentLease()) return;
      const dispatch = ++generation.current; hide();
      void runtime.home.lookup(barcode).catch(error => { if (dispatch === generation.current && isOwnerCurrent()) Alert.alert('Xatolik', String(error)); });
    } }], { cancelable: true, onDismiss: cancelSelection });
  };
  return { controller: runtime.home, visible, cameraActive, isScannerCurrent, scan, close, complete, issueRevision };
}
