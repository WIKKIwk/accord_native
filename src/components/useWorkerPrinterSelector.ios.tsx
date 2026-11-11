import { useContext, useEffect, useRef, useState } from 'react';
import { PreparationPrinterPicker } from '../preparation/PreparationPrinterPicker';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { WorkerSheetCloseContext } from './workerSheetContext';

type PickerPresentation = { id: number; select: (value: PreparationDeviceSelection | null) => void; dismissed: () => void };

function WorkerPrinterPicker({ select }: { select: (value: PreparationDeviceSelection | null) => void }) {
  const close = useContext(WorkerSheetCloseContext);
  return <PreparationPrinterPicker title="Bluetooth printer" emptyLabel="Bluetooth printer topilmadi" select={value => { select(value); close?.(); }} />;
}
export function useWorkerPrinterSelector(current: () => boolean) {
  const [picker, setPicker] = useState<PickerPresentation | null>(null);
  const nextId = useRef(0), pending = useRef<((value: PreparationDeviceSelection | null) => void) | null>(null);
  useEffect(() => () => { pending.current?.(null); pending.current = null; }, []);
  // Present inside the caller's native sheet; navigating to another route dismisses that sheet.
  return { dialogs: picker ? <WorkerOrderSheet key={picker.id} dismissible onClose={picker.dismissed}>
    <WorkerPrinterPicker select={picker.select} />
  </WorkerOrderSheet> : null, selectDevice: () => new Promise<PreparationDeviceSelection | null>(resolve => {
    if (!current() || pending.current) { resolve(null); return; }
    pending.current = resolve;
    let result: PreparationDeviceSelection | null = null;
    setPicker({ id: ++nextId.current, select: value => { if (pending.current === resolve) result = value; },
      dismissed: () => {
        if (pending.current !== resolve) return;
        pending.current = null; setPicker(null); resolve(current() ? result : null);
      },
    });
  }) };
}
