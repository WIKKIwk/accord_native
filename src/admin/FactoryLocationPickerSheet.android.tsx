import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useRef } from 'react';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet.android';
import { FactoryApparatusPicker } from './FactoryApparatusPicker.android';
import type { FactoryApparatusPickerProps } from './factoryApparatusPickerTypes';

export function FactoryLocationPickerSheet(props: FactoryApparatusPickerProps) {
  const ref = useRef<ModalBottomSheetRef>(null), closing = useRef(false), finished = useRef(false);
  const result = useRef<Set<string> | null>(null);
  const finish = () => {
    if (finished.current) return; finished.current = true;
    if (result.current) props.onConfirm(result.current); else props.onCancel();
  };
  const close = (value: Set<string> | null) => {
    if (closing.current) return; closing.current = true; result.current = value;
    void Promise.resolve(ref.current?.hide()).then(finish, finish);
  };
  return <WorkerOrderSheet sheetRef={ref} dismissible heightFraction={0.78} onClose={finish}>
    <FactoryApparatusPicker {...props} onConfirm={value => close(value)} onCancel={() => close(null)} />
  </WorkerOrderSheet>;
}
