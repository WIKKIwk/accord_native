import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { rawSplitSessionIsCurrent } from './rawSplitApi';
import { useRawSplitContext } from './RawSplitContext';

/** Whole-preview detections require an explicit barcode check until native scan-window parity exists. */
export function useRawSplitHomeScreen() {
  const { ticket, runtime } = useRawSplitContext(), [visible, setVisible] = useState(false);
  const focused = useRef(false), foreground = useRef(AppState.currentState === 'active'), open = useRef(false), generation = useRef(0);
  const [cameraActive, setCameraActive] = useState(false);
  const isOwnerCurrent = useCallback(() => focused.current && foreground.current && rawSplitSessionIsCurrent(ticket), [ticket]);
  const isScannerCurrent = useCallback(() => open.current && isOwnerCurrent(), [isOwnerCurrent]);
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
  const hide = () => { open.current = false; setCameraActive(false); setVisible(false); };
  const close = () => { generation.current++; hide(); };
  const scan = () => { if (!isOwnerCurrent() || runtime.home.locked) return; generation.current++; open.current = true; setVisible(true); setCameraActive(true); };
  const complete = (barcode: string) => {
    if (!isScannerCurrent()) return;
    const selection = ++generation.current; open.current = false; setCameraActive(false); runtime.home.setBarcode(barcode);
    const cancelSelection = () => { if (selection === generation.current) close(); };
    Alert.alert('Skanerlangan kod', barcode, [{ text: 'Bekor qilish', style: 'cancel', onPress: cancelSelection }, { text: 'Rulonni topish', onPress: () => {
      if (selection !== generation.current || !isOwnerCurrent()) return;
      const dispatch = ++generation.current; hide();
      void runtime.home.lookup(barcode).catch(error => { if (dispatch === generation.current && isOwnerCurrent()) Alert.alert('Xatolik', String(error)); });
    } }], { cancelable: true, onDismiss: cancelSelection });
  };
  return { controller: runtime.home, visible, cameraActive, isScannerCurrent, scan, close, complete };
}
