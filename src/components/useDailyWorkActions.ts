import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeSessionWitness, type Session } from '../auth';
import { dailyWorkApparatus, type DailyWorkBatch } from '../dailyWork';
import { canCorrectDailyWip, DailyWorkCorrectionController } from '../dailyWorkCorrection';
import { adminProgressBatchCorrect } from '../productionProgressCorrectionApi';
import type { useDailyWork } from './useDailyWork';
import { useWorkerOrderText } from './useWorkerOrderText';
import type { WorkerAlertData } from './workerDialogTypes';

function createOwner(session: Session) {
  let model: ReturnType<typeof useDailyWork> | null = null, mounted = false;
  const current = () => mounted && !!model?.current();
  const controller = new DailyWorkCorrectionController({
    current, canEdit: batch => canCorrectDailyWip(session, batch),
    latest: id => model?.batches?.find(batch => batch.id === id),
    operation: batch => dailyWorkApparatus(model?.catalog ?? [], batch.apparatus)?.operation ?? '',
    save: (input, current) => adminProgressBatchCorrect(session, input, current),
    replace: batch => model?.replaceBatch(batch), reconcile: () => { void model?.refresh(); },
  });
  return { controller, current, update: (value: ReturnType<typeof useDailyWork>) => { model = value; }, mount: (value: boolean) => { mounted = value; } };
}

export function useDailyWorkActions(session: Session, model: ReturnType<typeof useDailyWork>) {
  const owner = useMemo(() => createOwner(session), [session]), { controller } = owner;
  useLayoutEffect(() => owner.update(model), [owner, model]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [qrBatch, setQrBatch] = useState<DailyWorkBatch | null>(null);
  const [missingQr, setMissingQr] = useState(false);
  const pendingEdit = useRef<DailyWorkBatch | null>(null);
  useEffect(() => {
    owner.mount(true);
    const unsubscribe = subscribeSessionWitness(() => {
      if (!owner.current()) { controller.invalidate(); pendingEdit.current = null; setQrBatch(null); setMissingQr(false); }
    });
    return () => { owner.mount(false); pendingEdit.current = null; unsubscribe(); };
  }, [owner, controller]);
  const { p } = useWorkerOrderText();
  const canEdit = (batch: DailyWorkBatch) => controller.current() && !state.edit && canCorrectDailyWip(session, batch);
  const showQr = (batch: DailyWorkBatch) => {
    if (!controller.current() || state.edit) return;
    if (!batch.qr.trim()) setMissingQr(true); else setQrBatch(batch);
  };
  const qrClosed = () => {
    setQrBatch(null);
    const pending = pendingEdit.current; pendingEdit.current = null;
    if (pending) controller.open(pending);
  };
  const alert: WorkerAlertData | null = missingQr ? { title: p('worker.daily.wip_qr_missing'), message: p('worker.daily.wip_qr_missing.body') } : null;
  return { controller, state, qrBatch, showQr, qrClosed, canEdit, edit: controller.open,
    queueEdit: (batch: DailyWorkBatch) => { pendingEdit.current = batch; }, alert,
    dismissAlert: () => { setMissingQr(false); controller.dismissNotice(); } };
}
