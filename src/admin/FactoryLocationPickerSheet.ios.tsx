import { useContext, useRef } from 'react';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet.ios';
import { WorkerSheetCloseContext } from '../components/workerSheetContext';
import { FactoryApparatusPicker } from './FactoryApparatusPicker.ios';
import type { FactoryApparatusPickerProps } from './factoryApparatusPickerTypes';

function Content(props: FactoryApparatusPickerProps) {
  const close = useContext(WorkerSheetCloseContext);
  return <FactoryApparatusPicker {...props} onConfirm={value => { props.onConfirm(value); close?.(); }} onCancel={() => { props.onCancel(); close?.(); }} />;
}
export function FactoryLocationPickerSheet(props: FactoryApparatusPickerProps) {
  const result = useRef<Set<string> | null>(null), closing = useRef(false), finished = useRef(false);
  const choose = (value: Set<string> | null) => { if (!closing.current) { closing.current = true; result.current = value; } };
  const finish = () => {
    if (finished.current) return; finished.current = true;
    if (result.current) props.onConfirm(result.current); else props.onCancel();
  };
  return <WorkerOrderSheet dismissible heightFraction={0.78} onClose={finish}>
    <Content {...props} onConfirm={value => choose(value)} onCancel={() => choose(null)} />
  </WorkerOrderSheet>;
}
