import { WorkerAlert } from './WorkerAlert';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';
import type { WorkerQrScannerModel } from './useWorkerQrScanner';

export function WorkerQrScannerDialogs({ model }: { model: WorkerQrScannerModel }) {
  const { labels } = model;
  return <>
    <WorkerAlert alert={model.error ? { title: labels.guidance, message: model.error, confirmLabel: labels.close } : null} onDismiss={model.clearError} />
    <WorkerFormDialog visible={model.manualOpen} title={labels.manual} cancelLabel={labels.cancel} onCancel={model.cancelManual}
      confirmLabel={labels.verify} confirmDisabled={model.busy || !model.manual.trim()} onConfirm={model.confirmManual} onDismiss={model.manualDismissed}>
      <WorkerFormField label={labels.payload} initialValue={model.manual} onChangeText={model.setManual} />
    </WorkerFormDialog>
  </>;
}
