import { Text } from 'react-native';
import type { WorkerMergeState } from '../workerOrderMerge';
import { WorkerAlert } from './WorkerAlert';
import { WorkerFormDialog } from './WorkerFormDialog';
import { useWorkerOrderText } from './useWorkerOrderText';
import { useWorkerColors } from './useWorkerColors';

/** @v2 _ReadOnlyOrderDetailSheetState._confirmRollMerge */
export function WorkerOrderMergeDialog({ state, orderNumber, onCancel, onConfirm }: {
  state: WorkerMergeState; orderNumber: string; onCancel(): void; onConfirm(): void;
}) {
  const { p } = useWorkerOrderText(), colors = useWorkerColors();
  return <>
    <WorkerFormDialog visible={state.phase === 'confirmation'} title={p('worker.merge.confirm.title')}
      cancelLabel={p('worker.action.no')} confirmLabel={p('worker.merge.confirm.yes')}
      onCancel={onCancel} onConfirm={onConfirm} dismissOnBackdrop>
      {[p('worker.merge.confirm.message', state.labels), p('worker.merge.confirm.order', { order: orderNumber }),
        `QR: ${state.qrLabel ?? ''}`, p('worker.merge.confirm.warning')].map((line, index) =>
        <Text key={index} style={{ color: colors.text, fontSize: 16 }}>{line}</Text>)}
    </WorkerFormDialog>
    <WorkerAlert alert={state.phase === 'guidance' ? { title: p('worker.qr.guidance.title'), message: state.message ?? '',
      confirmLabel: p('worker.action.close') } : null} onDismiss={onCancel} />
  </>;
}
