import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import qrFactory from 'qrcode-generator';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { activeSessionToken, subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminLaminationAstatkaSnapshot, adminWorkerLayerRemainders } from '../workerLaminationApi';
import { adminSubmitLaminationAstatka } from '../laminationAstatkaSubmitApi';
import { adminLayerRemainderReprint } from '../workerLayerRemainderReprintApi';
import { layerRemainderEstimateMeter, laminationAstatkaInputRoll, type layerRemainderFromJson } from '../workerLaminationRemainders';
import { laminationReceiptJobs, WorkerLaminationWorkflow, type LaminationReportContext } from '../workerLaminationWorkflow';
import { pickWorkerPrinter, printWorkerJobs, WorkerPrintCancelled, workerPrinterFields } from '../workerPrinting';
import { adminProgressQrReprint } from '../productionProgressReprintApi';
import { adminApparatusQueueActionResult } from '../workerQueueAction';
import { workerReportPendingStore } from '../workerReportPendingStore';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';
import { WorkerProgressField } from './WorkerProgressField';
import { WorkerOrderButton as WorkerActionButton } from './WorkerOrderControls';
import { useWorkerOrderText } from './useWorkerOrderText';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';

type Remainder = ReturnType<typeof layerRemainderFromJson>;
Object.assign(qrFactory, { stringToBytes: (text: string) => Array.from(new TextEncoder().encode(text)) });
type Props = { session: Session; context: LaminationReportContext; onAttempted(): void; onCommitted(): void; onClose(completed: boolean): void };

function createOwner(session: Session, apparatus: string, orderId: string, stage: string, complete: boolean, fullReport: boolean) {
  let mounted = false, callbacks: Props | null = null;
  const context = { apparatus, orderId, stage, complete, fullReport }, scope = sessionReadScope(session);
  const current = () => mounted && !!activeSessionToken(session) && scope === sessionReadScope(session);
  const key = JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref, context.apparatus, context.orderId, context.complete ? 'lamination_complete' : 'lamination_astatka']);
  const workflow = new WorkerLaminationWorkflow({ context, key, current, newRequestId: () => `${context.complete ? 'complete' : 'astatka'}-${randomUUID()}`,
    read: request_id => adminLaminationAstatkaSnapshot(session, { apparatus: context.apparatus, order_id: context.orderId, request_id }, current),
    save: (request, guard) => adminSubmitLaminationAstatka(session, request, guard), store: workerReportPendingStore,
    freeze: (note, guard) => adminApparatusQueueActionResult(session, { apparatus, order_id: orderId, action: 'freeze', freeze_with_issue: true, issue_note: note, include_control: true }, guard),
    attempted: () => callbacks?.onAttempted(), committed: () => callbacks?.onCommitted() });
  return { workflow, current, close: () => callbacks?.onClose(current() && workflow.getSnapshot().phase === 'receipt'), update: (next: Props) => { callbacks = next; }, mount: (value: boolean) => { mounted = value; } };
}

function LabelQr({ payload }: { payload: string }) {
  const colors = useWorkerColors();
  const uri = useMemo(() => {
    try { const qr = qrFactory(0, 'M'); qr.addData(payload); qr.make(); return qr.createDataURL(4, 12); } catch { return ''; }
  }, [payload]);
  return <View style={{ alignItems: 'center', gap: 6 }}>{uri ? <Image source={{ uri }} style={{ width: 160, height: 160, backgroundColor: '#fff' }} /> : null}<Text selectable style={{ color: colors.text }}>{payload}</Text></View>;
}

/** @v2 _IntegratedLaminationAstatka._runIntegratedLaminationAstatka */
export function WorkerLaminationReport(props: Props) {
  const { session } = props, [context] = useState(() => ({ ...props.context })), colors = useWorkerColors(), { p, t } = useWorkerOrderText();
  const owner = useMemo(() => createOwner(session, context.apparatus, context.orderId, context.stage, context.complete, context.fullReport),
    [session, context.apparatus, context.orderId, context.stage, context.complete, context.fullReport]), { workflow } = owner;
  useLayoutEffect(() => owner.update(props), [owner, props]);
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  const [hidden, setHidden] = useState(false), [printing, setPrinting] = useState(false), [printStatus, setPrintStatus] = useState('');
  const [history, setHistory] = useState<Remainder[]>([]), [historyError, setHistoryError] = useState('');
  const printBusy = useRef(false), closing = useRef(false), dismissed = useRef<(() => void) | null>(null), automaticReceipt = useRef<object | null>(null);
  const selector = useWorkerPrinterSelector(owner.current);
  useEffect(() => {
    owner.mount(true); void workflow.load();
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) { workflow.invalidate(); owner.close(); } });
    return () => { owner.mount(false); unsubscribe(); dismissed.current?.(); dismissed.current = null; };
  }, [owner, workflow]);
  const loadHistory = useCallback(async () => {
    try { const rows = await adminWorkerLayerRemainders(session, context.apparatus, context.orderId, owner.current);
      if (owner.current()) { setHistory(rows); setHistoryError(''); }
    } catch { if (owner.current()) setHistoryError('worker.layer_remainder.failed'); }
  }, [session, context.apparatus, context.orderId, owner]);
  useEffect(() => { if (state.phase === 'receipt' && !state.issueNotice) void Promise.resolve().then(loadHistory); }, [state.phase, state.issueNotice, loadHistory]);
  const chooseAndPrint = useCallback(async (print: (printer: Awaited<ReturnType<typeof pickWorkerPrinter>>) => Promise<void>) => {
    if (printBusy.current || closing.current || !owner.current()) return;
    printBusy.current = true; setPrinting(true); setPrintStatus('');
    try {
      if (Platform.OS === 'ios') await new Promise<void>(resolve => { dismissed.current = resolve; setHidden(true); }); else setHidden(true);
      const printer = await pickWorkerPrinter({ current: owner.current, selectDevice: selector.selectDevice });
      await print(printer);
      if (owner.current()) setPrintStatus('worker.layer_remainder.printed');
    } catch (reason) { if (owner.current()) setPrintStatus(reason instanceof WorkerPrintCancelled ? 'worker.layer_remainder.print_pending' : 'worker.layer_remainder.print_failed'); }
    finally { printBusy.current = false; if (owner.current()) { setPrinting(false); setHidden(false); } }
  }, [owner, selector.selectDevice]);
  useEffect(() => {
    if (state.phase !== 'receipt' || !state.receipt || automaticReceipt.current === state.receipt) return;
    automaticReceipt.current = state.receipt;
    void Promise.resolve().then(() => {
      if (!owner.current()) return;
      try {
        const jobs = laminationReceiptJobs(state.receipt!);
        if (jobs.length) void chooseAndPrint(printer => printWorkerJobs({ print_jobs: jobs }, printer, owner.current));
      } catch { setPrintStatus('worker.layer_remainder.print_pending'); }
    });
  }, [state.phase, state.receipt, chooseAndPrint, owner]);
  const receipt = state.phase === 'receipt', edit = state.phase === 'edit', pending = state.phase === 'pending', saving = state.phase === 'saving';
  async function close() {
    if (closing.current || printBusy.current || workflow.getSnapshot().phase === 'saving') return;
    closing.current = true;
    if (Platform.OS === 'ios') await new Promise<void>(resolve => { dismissed.current = resolve; setHidden(true); });
    else setHidden(true);
    if (owner.current()) owner.close();
  }
  const output = context.complete || state.snapshot?.session_status === 'active';
  const ReportField = context.complete ? WorkerProgressField : WorkerFormField;
  const valueField = (key: keyof typeof state.values, label: string, unit = 'kg') => <ReportField key={key} label={`${p(label)}${unit ? ` (${unit})` : ''}`} initialValue={state.values[key]}
    keyboardType={key === 'note' ? 'default' : 'decimal-pad'} onChangeText={value => workflow.change(key, value)} />;
  const rows = history.length ? history : state.receipt?.remainders ?? [];
  return <>
    <WorkerFormDialog visible={!hidden} progressAction={Platform.OS === 'android' && context.complete ? 'complete' : undefined}
      title={p(context.complete ? 'worker.progress.qty.title.complete' : 'worker.laminatsiya.astatka.title')}
      cancelLabel={p('worker.action.close')} onCancel={() => { void close(); }} cancelDisabled={saving || printing} preventDismiss
      confirmLabel={receipt ? p('worker.action.close') : state.phase === 'error' ? t('Qayta urinish') : pending ? p('worker.layer_remainder.retry') : t('Saqlash')}
      confirmDisabled={state.phase === 'loading' || saving || printing}
      onDismiss={() => { dismissed.current?.(); dismissed.current = null; }}
      onConfirm={() => { if (receipt) void close(); else if (state.phase === 'error') void workflow.load(); else void workflow.submit(); }}>
      {state.phase === 'loading' ? <ActivityIndicator /> : null}
      {state.error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{p(state.error)}</Text> : null}
      {pending ? <Text style={{ color: colors.text }}>{p(context.complete ? 'worker.lamination_complete.pending' : 'worker.lamination_astatka.pending')}</Text> : null}
      {saving ? <ActivityIndicator /> : null}
      {edit ? <>
        <Text style={{ color: colors.muted }}>{p(context.complete ? 'worker.lamination_complete.instruction' : output ? 'worker.lamination_astatka.active_instruction' : state.snapshot?.session_status === 'completed' ? 'worker.lamination_astatka.completed_instruction' : 'worker.lamination_astatka.paused_instruction')}</Text>
        {output ? <>{valueField('meter', 'worker.daily.field.length', 'm')}{valueField('kg', 'worker.daily.field.weight')}{valueField('bobina', 'worker.daily.field.roll')}</> : null}
        {valueField('wip', 'worker.daily.field.print_leftover')}{valueField('film', 'worker.daily.field.film_leftover')}
        {(['wip', 'film'] as const).map(kind => {
          const source = state.snapshot ? laminationAstatkaInputRoll(state.snapshot, kind) : null;
          const estimate = source ? layerRemainderEstimateMeter(source, Number(state.values[kind].replace(',', '.'))) : null;
          return estimate == null ? null : <Text key={kind} style={{ color: colors.muted }}>{`${source?.item_name}: ${Number(estimate.toFixed(3))} m`}</Text>;
        })}
        {valueField('waste', 'worker.daily.field.total_waste')}{valueField('note', context.complete ? 'worker.progress.qty.reason' : 'worker.progress.qty.optional_note', '')}
      </> : null}
      {receipt ? <>
        <Text style={{ color: colors.text }}>{p(state.issueNotice || (state.resumeGuidance ? 'worker.lamination_astatka.resume_scan' : !state.receipt ? 'worker.layer_remainder.history' : context.complete ? 'worker.lamination_complete.saved' : state.snapshot?.session_status === 'completed' ? 'worker.lamination_astatka.saved_completed' : 'worker.lamination_astatka.saved'))}</Text>
        {printStatus ? <Text accessibilityRole="alert" style={{ color: colors.text }}>{p(printStatus)}</Text> : null}
        {state.receipt?.progress_batches.map(batch => <View key={String(batch.batch_id)} style={{ gap: 8 }}>
          <LabelQr payload={String(batch.qr_payload)} /><WorkerActionButton label={t('QR kodni qayta chop etish')} disabled={printing} onPress={() => {
            void chooseAndPrint(async printer => {
              const result = await adminProgressQrReprint(session, { qr_payload: String(batch.qr_payload), progress_batch_id: String(batch.batch_id), ...workerPrinterFields(printer) });
              if (!result.ok || !result.print_job || result.print_job.epc !== batch.qr_payload) throw new Error('print_failed');
              await printWorkerJobs(result, printer, owner.current); });
          }} />
        </View>)}
        {historyError ? <><Text style={{ color: colors.error }}>{p(historyError)}</Text><WorkerActionButton label={t('Qayta urinish')} onPress={() => { void loadHistory(); }} /></> : null}
        {rows.map(row => <View key={row.operation_id} style={{ gap: 8 }}>
          <Text style={{ color: colors.text }}>{`${row.item_name} · ${row.remaining_net_kg} kg · ${Number(row.remaining_meter.toFixed(3))} m`}</Text>
          <LabelQr payload={row.qr_payload} /><WorkerActionButton label={t('QR kodni qayta chop etish')} disabled={printing} onPress={() => {
            void chooseAndPrint(async printer => { const result = await adminLayerRemainderReprint(session, { apparatus: context.apparatus, order_id: context.orderId, operation_id: row.operation_id, ...workerPrinterFields(printer) }, owner.current);
              if (!result.print_ok || result.remainder.operation_id !== row.operation_id || result.remainder.qr_payload !== row.qr_payload || result.print_job?.epc !== row.qr_payload) throw new Error('print_failed');
              await printWorkerJobs(result, printer, owner.current); });
          }} />
        </View>)}
        {!rows.length && !state.receipt?.progress_batches.length && !historyError && !state.issueNotice ? <Text style={{ color: colors.muted }}>{p('worker.layer_remainder.empty')}</Text> : null}
      </> : null}
    </WorkerFormDialog>{selector.dialogs}
  </>;
}
