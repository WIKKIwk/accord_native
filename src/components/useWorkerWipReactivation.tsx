import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { workerProductionOrderDetail } from '../workerDetailApi';
import { prepareWorkerWipReactivation, runWorkerWipReactivation, workerReactivationDenialKey, type WorkerWipReactivationReview } from '../workerWipReactivation';
import type { WipApparatusNames, WipBatch, WipOrder } from '../workerWip';
import { useNativeSheet } from '../nativeSheet';
import { WorkerSheetButton } from './WorkerSheetButton';
import { WorkerPaddonDialog } from './WorkerPaddonDialog';
import { WorkerPaddonFeedback } from './WorkerPaddonFeedback';
import { useWorkerPaddonPresentation } from './useWorkerPaddonPresentation';
import { useWorkerOrderText } from './useWorkerOrderText';
import { useWorkerColors } from './useWorkerColors';
import { WorkerAlert } from './WorkerAlert';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Choice = 'reactivate' | 'details' | null;
type Props = { session: Session; order: WipOrder; apparatusNames: WipApparatusNames; operation?: string; allowReactivation?: boolean;
  showDetails: (batch: WipBatch) => void; onAttempted?: () => void; onWritePending?: (pending: boolean) => void };

function WipReactivationMenu({ review, choose }: { review: WorkerWipReactivationReview; choose: (choice: Choice) => void }) {
  const { p } = useWorkerOrderText(), colors = useWorkerColors();
  const reason = workerReactivationDenialKey(review.reason);
  const [reasonOpen, setReasonOpen] = useState(false);
  const close = useContext(WorkerSheetCloseContext);
  const pick = (choice: Choice) => { choose(choice); close?.(); };
  return <View style={{ padding: 20, gap: 16 }}>
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{review.identity}</Text>
    {!review.target ? <Text style={{ color: colors.text }}>{p(reason)}</Text> : null}
    <WorkerSheetButton label={p(review.actionKey)} variant="filled" disabled={!review.target}
      icon={{ android: 'restart_alt', ios: 'arrow.counterclockwise' }} onPress={() => pick('reactivate')} />
    {!review.target && ['final_stage_closed', 'order_closed'].includes(review.reason) ? <WorkerSheetButton label={p('worker.reactivate.reason_details')}
      onPress={() => setReasonOpen(true)} /> : null}
    <WorkerSheetButton label={p('worker.reactivate.details')} icon={{ android: 'info', ios: 'info.circle' }} onPress={() => pick('details')} />
    <WorkerAlert alert={reasonOpen ? { title: p(review.actionKey), message: p(reason), confirmLabel: p('worker.action.close') } : null} onDismiss={() => setReasonOpen(false)} />
  </View>;
}

function ownerFor(session: Session, scope: string) {
  const witness = captureSessionWitness(session);
  let mounted = false;
  return { mount(value: boolean) { mounted = value; }, current: () => mounted && !!activeSessionToken(session) && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope };
}

/** @v2 _WorkerWipHistorySheetState._showWipActions */
export function useWorkerWipReactivation(props: Props) {
  const { session, order, apparatusNames, operation = '', allowReactivation = false, showDetails, onAttempted, onWritePending } = props;
  const { p } = useWorkerOrderText(), scope = sessionReadScope(session);
  const owner = useMemo(() => ownerFor(session, scope), [session, scope]);
  const sheet = useNativeSheet(), presentation = useWorkerPaddonPresentation(owner.current);
  const busy = useRef(false), request = useRef<AbortController | null>(null), pendingChoice = useRef<((choice: Choice) => void) | null>(null);
  useLayoutEffect(() => { owner.mount(true); return () => owner.mount(false); }, [owner]);
  useEffect(() => {
    const invalidate = () => { if (!owner.current()) { request.current?.abort(); sheet.close(); pendingChoice.current?.(null); pendingChoice.current = null; } };
    const unsubscribe = subscribeSessionWitness(invalidate);
    return () => { unsubscribe(); request.current?.abort(); pendingChoice.current?.(null); pendingChoice.current = null; sheet.close(); };
  }, [owner, sheet]);

  async function open(batch: WipBatch) {
    if (busy.current || sheet.isOpen() || presentation.isOpen() || !owner.current()) return;
    if (!allowReactivation || !['laminate', 'glue', 'cut'].includes(operation)) { showDetails(batch); return; }
    busy.current = true;
    const controller = new AbortController(); request.current = controller;
    const current = () => owner.current() && !controller.signal.aborted && request.current === controller;
    try {
      let map: Record<string, any> = { id: order.id, code: order.code, title: order.title };
      try { const snapshot = await workerProductionOrderDetail(session, order.apparatusId, order.id, controller.signal); map = snapshot.maps[0].map; } catch { /* A partial map never enables reactivation. */ }
      if (!current()) return;
      const review = await prepareWorkerWipReactivation(session, { apparatus: { id: order.apparatusId, name: apparatusNames[order.apparatusId] ?? '', operation },
        map, batch: { batch_id: batch.batch_id, qr_payload: batch.qr_payload }, workerMode: true, allowReactivation }, p, current);
      if (!current()) return;
      if (!review) { showDetails(batch); return; }
      const choice = await new Promise<Choice>(resolve => {
        let chosen: Choice = null;
        pendingChoice.current = resolve;
        sheet.open(<WipReactivationMenu review={review} choose={value => { if (current()) chosen = value; }} />,
          { dismissible: true, compact: true, onDismiss() { pendingChoice.current = null; resolve(current() ? chosen : null); } });
      });
      if (!current()) return;
      if (choice === 'details') { showDetails(batch); return; }
      if (choice !== 'reactivate' || !review.target) return;
      const confirmed = await presentation.open({ title: p(review.actionKey), message: `${review.identity}\n\n${p(review.explanationKey)}`,
        cancelLabel: p('worker.action.cancel'), confirmLabel: p('worker.reactivate.confirm') });
      if (confirmed !== 'confirm' || !current()) return;
      onWritePending?.(true);
      let outcome;
      try { outcome = await runWorkerWipReactivation(session, review, current); }
      finally { onWritePending?.(false); }
      if (!current() || !outcome.attempted) return;
      onAttempted?.();
      presentation.message(outcome.succeeded ? p('worker.reactivate.success') : `${p(workerReactivationDenialKey(outcome.reason))}\n${p('worker.reactivate.unconfirmed')}`);
    } finally { if (request.current === controller) request.current = null; busy.current = false; }
  }
  return { open, isBusy: () => busy.current, dialogs: <><WorkerPaddonDialog data={presentation.data} visible={presentation.visible} close={presentation.close} dismissed={presentation.dismissed} />
    <WorkerPaddonFeedback message={presentation.notice} /></> };
}
