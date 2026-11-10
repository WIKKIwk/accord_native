import { useEffect, useRef } from 'react';
import { useNativeSheet } from '../nativeSheet';
import { PreparationPrinterPicker } from '../preparation/PreparationPrinterPicker';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
export function useWorkerPrinterSelector(current: () => boolean) {
  const sheet = useNativeSheet(), pending = useRef<((value: PreparationDeviceSelection | null) => void) | null>(null);
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  return { dialogs: null, selectDevice: () => new Promise<PreparationDeviceSelection | null>(resolve => {
    if (!current() || pending.current) { resolve(null); return; }
    pending.current = resolve;
    let result: PreparationDeviceSelection | null = null;
    sheet.open(<PreparationPrinterPicker select={value => { result = value; sheet.close(); }} />, {
      dismissible: true, onDismiss: () => { pending.current?.(current() ? result : null); pending.current = null; },
    });
  }) };
}
