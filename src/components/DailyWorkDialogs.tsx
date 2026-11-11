import { Text } from 'react-native';
import { useEffect } from 'react';
import type { Session } from '../auth';
import type { useDailyWork } from './useDailyWork';
import type { useDailyWorkActions } from './useDailyWorkActions';
import { WorkerFormDialog } from './WorkerFormDialog';
import { DailyWorkCorrectionFields } from './DailyWorkCorrectionFields';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { WorkerWipBatchDetails } from './WorkerWipBatchDetails';
import { WorkerAlert } from './WorkerAlert';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';
import { dailyWorkProductTitle, dailyWorkQrRows } from '../dailyWorkPresentation';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';

export function DailyWorkDialogs({ session, model, actions }: { session: Session; model: ReturnType<typeof useDailyWork>; actions: ReturnType<typeof useDailyWorkActions> }) {
  const { p, t } = useWorkerOrderText(), colors = useWorkerColors();
  const { controller, state, qrBatch } = actions, edit = state.edit;
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(controller.dismissNotice, 4000);
    return () => clearTimeout(timer);
  }, [controller, state.notice]);
  const error = edit?.error;
  const errorValues = error?.values?.label ? { ...error.values, label: p(String(error.values.label)) } : error?.values;
  return <>
    {qrBatch ? <WorkerOrderSheet key={actions.qrPresentationId} dismissible onClose={actions.qrClosed}>
      <WorkerWipBatchDetails session={session} batch={qrBatch.source}
        order={{ id: qrBatch.orderId, code: qrBatch.code, title: qrBatch.title, imageId: '', apparatusId: qrBatch.apparatus }}
        apparatusNames={model.apparatusNames} onClose={actions.qrClosed} allowReprint
        title={p('worker.daily.wip_qr')} itemName={dailyWorkProductTitle(qrBatch)}
        detailRows={dailyWorkQrRows(qrBatch, model.apparatusNames, p, session.assigned_apparatus)}
        onEdit={actions.canEdit(qrBatch) ? () => actions.queueEdit(qrBatch) : undefined} />
    </WorkerOrderSheet> : null}
    <WorkerFormDialog visible={!!edit} title={p(edit?.step === 'edit' ? 'worker.daily.edit.title' : 'worker.daily.correction.title')}
      confirmLabel={t('Saqlash')} onConfirm={() => { if (edit?.step === 'edit') controller.next(); else void controller.confirm(); }}
      confirmDisabled={edit?.step === 'saving'} cancelDisabled={edit?.step === 'saving'} preventDismiss onCancel={controller.cancel}>
      {edit ? <DailyWorkCorrectionFields edit={edit} controller={controller} /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{p(error.key, errorValues)}</Text> : null}
    </WorkerFormDialog>
    <WorkerPaddonFeedback message={state.notice ? p(state.notice) : ''} />
    <WorkerAlert alert={actions.alert} onDismiss={actions.dismissAlert} />
  </>;
}
