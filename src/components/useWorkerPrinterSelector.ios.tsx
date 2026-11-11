import { useContext, useEffect, useRef } from 'react';
import { useNativeSheet } from '../nativeSheet';
import { PreparationPrinterPicker } from '../preparation/PreparationPrinterPicker';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { WorkerSheetCloseContext } from './workerSheetContext';

function WorkerPrinterPicker({ select }: { select: (value: PreparationDeviceSelection | null) => void }) {
  const close = useContext(WorkerSheetCloseContext);
  return <PreparationPrinterPicker title="Bluetooth printer" emptyLabel="Bluetooth printer topilmadi" select={value => { select(value); close?.(); }} />;
}
export function useWorkerPrinterSelector(current: () => boolean) {
  const sheet = useNativeSheet(), pending = useRef<((value: PreparationDeviceSelection | null) => void) | null>(null);
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  return { dialogs: null, selectDevice: () => new Promise<PreparationDeviceSelection | null>(resolve => {
    if (!current() || pending.current) { resolve(null); return; }
    pending.current = resolve;
    let result: PreparationDeviceSelection | null = null;
    sheet.open(<WorkerPrinterPicker select={value => { result = value; }} />, {
      dismissible: true, onDismiss: () => {
        if (pending.current !== resolve) return;
        pending.current = null; resolve(current() ? result : null);
      },
    });
  }) };
}
