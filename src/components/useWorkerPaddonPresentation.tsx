import { useEffect, useRef, useState } from 'react';
import { Platform, ToastAndroid } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { WorkerPaddonPicker } from './WorkerPaddonPicker';
import type { WorkerPaddonChoice, WorkerPaddonDialogData } from './workerPaddonPresentation';

/** Resolve iOS modal/sheet decisions only after actual native dismissal. */
export function useWorkerPaddonPresentation(current: () => boolean) {
  const [dialog, setDialog] = useState<{ data: WorkerPaddonDialogData; visible: boolean } | null>(null);
  const pending = useRef<((value: string | null) => void) | null>(null), result = useRef<string | null>(null), closing = useRef(false);
  const [notice, setNotice] = useState(''), sheet = useNativeSheet(), sheetPending = useRef<((value: string | null) => void) | null>(null);
  const complete = () => {
    const resolve = pending.current; pending.current = null; closing.current = false;
    resolve?.(current() ? result.current : null);
  };
  const dismissed = () => { setDialog(null); complete(); };
  useEffect(() => {
    if (Platform.OS === 'android' && dialog && !dialog.visible) complete();
    // Android's Compose dialog is removed by this commit; iOS waits on Modal.onDismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog?.visible]);
  useEffect(() => () => { pending.current?.(null); pending.current = null; sheetPending.current?.(null); sheetPending.current = null; }, []);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); } }, [notice]);
  return { data: dialog?.data ?? null, visible: !!dialog?.visible, notice, dismissed,
    isOpen: () => !!pending.current || !!sheetPending.current,
    message(value: string) { if (!current()) return; if (Platform.OS === 'android') ToastAndroid.show(value, ToastAndroid.LONG); else setNotice(value); },
    open(data: WorkerPaddonDialogData) { return new Promise<string | null>(resolve => {
      if (!current() || pending.current || sheetPending.current) { resolve(null); return; }
      pending.current = resolve; result.current = null; closing.current = false; setDialog({ data, visible: true });
    }); },
    close(value: string | null) { if (!pending.current || closing.current) return; result.current = value; closing.current = true;
      setDialog(previous => previous ? { ...previous, visible: false } : previous); },
    pick(choices: WorkerPaddonChoice[], compact = false) { return new Promise<string | null>(resolve => {
      if (!current() || pending.current || sheetPending.current || sheet.isOpen()) { resolve(null); return; }
      sheetPending.current = resolve; let chosen: string | null = null;
      sheet.open(<WorkerPaddonPicker choices={choices} compact={compact} choose={id => { if (current()) chosen = id; sheet.close(); }} />,
        { heightFraction: compact ? undefined : 0.6, fitContent: compact, dismissible: true, onDismiss() {
          const finish = sheetPending.current; sheetPending.current = null; finish?.(current() ? chosen : null);
        } });
    }); },
  };
}
