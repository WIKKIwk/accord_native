import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { subscribeSessionWitness, type Session } from '../auth';
import { adminTemporarilyPauseWork, type AdminTemporaryPauseControl } from '../workerControlsApi';
import { prepareWorkerFabQr, workerFabErrorText, workerFabTemporaryPause, workerFabChanged } from '../workerFabQr';
import { workerFabQrReads } from '../workerFabQrReads';
import type { Apparatus } from '../workerApi';
import { WorkerAlert } from './WorkerAlert';
import { WorkerSwitchPrompt } from './WorkerSwitchPrompt';
import { useWorkerOrderText } from './useWorkerOrderText';

type Obj = Record<string, any>;
type Prompt = { temporary: AdminTemporaryPauseControl | null; complete: boolean; astatka: boolean; mode: string };
type Props = { session: Session; apparatus: Apparatus; apparatusCatalog?: Apparatus[]; orderId: string; orderLabel: string; qr: string; ready: boolean; data: Obj | null;
  current(): boolean; snapshot(): Obj | null; onError(message: string): void; onReport(action: 'complete' | 'astatka'): void;
  onPauseStart(): void; onPauseEnd(success: boolean): void; onProceed(): void };

function createSwitchOwner(session: Session, apparatus: string) {
  let mounted = false, callbacks: Props | null = null;
  const reads = workerFabQrReads(session, apparatus, () => callbacks?.snapshot() ?? null, () => mounted && callbacks?.current() === true);
  return { reads, mount(value: boolean) { mounted = value; }, update(value: Props) { callbacks = value; } };
}

/** @v2 _ReadOnlyOrderDetailSheetState._confirmAndSwitchToScannedOrder */
export function WorkerInitialOrderSwitch(props: Props) {
  const { session, apparatus, orderId, orderLabel, qr, ready } = props, { p } = useWorkerOrderText();
  const [prompt, setPrompt] = useState<Prompt | null>(null), handled = useRef(false), choosing = useRef(false);
  const latest = useRef(props); useLayoutEffect(() => { latest.current = props; }, [props]);
  const [owner] = useState(() => createSwitchOwner(session, apparatus.id)), { reads } = owner;
  useLayoutEffect(() => owner.update(props), [owner, props]);
  const prepare = useEffectEvent(async () => {
    try {
      const result = await prepareWorkerFabQr(session, apparatus, qr, reads, p, id => props.apparatusCatalog?.find(machine => machine.id === id)?.name ?? (id === apparatus.id ? apparatus.name : id));
      if (!reads.current()) return;
      if (result.switching && result.orderId !== orderId) throw workerFabChanged();
      const data = latest.current.data;
      if (!data || !latest.current.ready) throw workerFabChanged();
      const control = data.control_state.control;
      const complete = control.allowed_actions.includes('complete');
      const temporary = workerFabTemporaryPause(session, apparatus.id, orderId, data, true);
      const target = await reads.context(result.scannedOrderId, '');
      if (!reads.current()) return;
      const targetControl = target.bootstrap.control_state.control;
      if (!targetControl.allowed_actions.includes('start') && !(targetControl.interaction.mode === 'fresh_start_blocked' &&
          targetControl.interaction.blocking_reason_code === 'apparatus_busy' && (complete || temporary))) throw workerFabChanged();
      setPrompt({ temporary, complete,
        astatka: ['laminate', 'glue', 'cut'].includes(apparatus.operation) && control.stage_work?.astatka_required === true &&
          ['paused', 'completed'].includes(control.interaction.mode), mode: control.interaction.mode });
    } catch (error) { if (reads.current()) latest.current.onError(workerFabErrorText(error, p)); }
  });
  useEffect(() => {
    owner.mount(true);
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.reads.current()) { choosing.current = true; setPrompt(null); } });
    return () => { owner.mount(false); unsubscribe(); };
  }, [owner]);
  useEffect(() => {
    if (!ready || handled.current) return;
    handled.current = true; void prepare();
  }, [ready]);
  async function choose(temporary: boolean) {
    const selected = prompt;
    setPrompt(null);
    if (!selected || choosing.current || !reads.current()) return;
    choosing.current = true;
    if (!temporary) {
      if (!latest.current.ready || (selected.complete && !latest.current.data?.control_state?.control?.allowed_actions?.includes('complete'))) { latest.current.onError(p('worker.error.sync')); return; }
      if (selected.complete) latest.current.onReport('complete');
      else if (selected.astatka) latest.current.onReport('astatka');
      else latest.current.onProceed();
      return;
    }
    let succeeded = false;
    latest.current.onPauseStart();
    try {
      const current = await reads.context(orderId, ''), control = workerFabTemporaryPause(session, apparatus.id, orderId, current.bootstrap, true);
      if (!control || !selected.temporary || control.session_id !== selected.temporary.session_id || control.token !== selected.temporary.token) throw workerFabChanged();
      await adminTemporarilyPauseWork(session, apparatus.id, orderId, control, reads.current);
      succeeded = reads.current();
    } catch { /* V2 refreshes an uncertain write, without replaying it or falling back to output. */ }
    finally { if (reads.current()) latest.current.onPauseEnd(succeeded); }
  }
  if (!prompt) return null;
  if (prompt.temporary) return <WorkerSwitchPrompt apparatus={apparatus.name} order={orderLabel} canComplete={prompt.complete}
    onChoose={choice => { if (choice === null) { choosing.current = true; setPrompt(null); } else void choose(choice === 'temporary_pause'); }} />;
  const bodyKey = prompt.mode === 'in_progress' ? 'worker.order.switch.complete_current' : ['laminate', 'glue', 'cut'].includes(apparatus.operation) ? 'worker.order.switch.report_current' : 'worker.order.switch.stop_current';
  return <WorkerAlert alert={{ title: p('worker.order.switch.title'), message: `${p('worker.order.switch.current_order', { apparatus: apparatus.name, order: orderLabel })}\n\n${p(bodyKey)}`,
    cancelLabel: p('worker.action.no'), confirmLabel: p('worker.order.switch.confirm'), onConfirm: () => { void choose(false); } }}
    onDismiss={() => setPrompt(null)} onCancel={() => { choosing.current = true; setPrompt(null); }} />;
}
