import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Text, View, type ScrollView } from 'react-native';
import { activeSessionToken, subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { runningFreezeRequest, type QueueCursor } from '../workerOrderLogic';
import { readWorkerActionControl } from '../workerLongPress';
import { canWorkOnApparatus } from '../workerApi';
import { adminRezkaOutputReport } from '../rezkaOutputReportApi';
import { adminApparatusQueueActionResult } from '../workerQueueAction';
import { adminProgressQrReprint } from '../productionProgressReprintApi';
import { pickWorkerPrinter, printWorkerJobs, workerPrinterFields, WorkerPrintCancelled, type WorkerPrinter } from '../workerPrinting';
import { WorkerRezkaOutputWorkflow, type RezkaOutputControl, type RezkaOutputSnapshot } from '../workerRezkaOutputWorkflow';
import { rezkaStageOptions, type RezkaOutputDeviation } from '../workerRezkaOutputModel';
import { WorkerReportModalFlow } from '../workerReportModalFlow';
import { rezkaFrameAt, rezkaFrameIssueNote, rezkaFramePeremotkaReason } from '../workerRezkaReport';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerReportField } from './WorkerReportField';
import { WorkerFramePrint } from './WorkerFramePrint';
import { WorkerOrderButton } from './WorkerOrderControls';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';

type Props = { session: Session; apparatus: string; orderId: string; stage: string; action: string; map: Record<string, any>; fullCompletionReportRequired?: boolean; getCursor(): QueueCursor | null;
  onAttempted(): void; onCommitted(final: boolean): void; onClose(completed: boolean): void };
type Panel = { kind: 'main' } | { kind: 'discard' } | { kind: 'choice'; index: number } | { kind: 'reason'; index: number; peremotka: boolean } | { kind: 'deviation'; value: RezkaOutputDeviation };
type Bridge = { printer(): Promise<WorkerPrinter>; confirm(deviation: RezkaOutputDeviation): Promise<boolean> };

function createOwner(props: Props) {
  const { session, apparatus, orderId, stage, action, map } = props, scope = sessionReadScope(session), options = rezkaStageOptions(map, stage);
  let mounted = false, callbacks = props, bridge: Bridge | null = null;
  const current = () => mounted && !!activeSessionToken(session) && scope === sessionReadScope(session) && canWorkOnApparatus({ id: apparatus, name: '', operation: 'cut' }, session.assigned_apparatus);
  async function controlData() {
    if (!current()) throw new Error('worker.error.sync');
    const data = await readWorkerActionControl(session, apparatus, orderId, () => callbacks.getCursor());
    if (!current() || data.control_state?.order_control !== 'active' && data.control_state?.order_control !== 'freeze_requested' ||
        data.control_state.control.stage_node_id !== stage || !data.control_state.control.allowed_actions.includes(action)) throw new Error('worker.error.sync');
    return data;
  }
  const workflow = new WorkerRezkaOutputWorkflow({ context: { apparatus, orderId, action, stage, ...options, autofill: !map.products?.length }, current,
    read: async (): Promise<RezkaOutputSnapshot> => {
      const data = await controlData(), frozen = !!runningFreezeRequest(data.control_state, apparatus);
      const snapshot = frozen ? null : await adminRezkaOutputReport(session, apparatus, orderId, current);
      if (snapshot) {
        const cursor = callbacks.getCursor();
        if (snapshot.epoch !== data.control_state.epoch || snapshot.revision < data.control_state.rev ||
            JSON.stringify(snapshot.kadr_counts) !== JSON.stringify(data.control_state.control.rezka_output_kadr_counts) ||
            cursor?.epoch && (cursor.epoch !== snapshot.epoch || typeof cursor.rev === 'number' && snapshot.revision < cursor.rev)) throw new Error('worker.error.sync');
        return snapshot;
      }
      // Older servers expose the same scoped report in the action contract.
      const control = data.control_state.control;
      if (!control.rezka_output_report || !control.rezka_output_kadr_counts?.length) throw new Error('worker.error.sync');
      return { report: control.rezka_output_report, kadr_counts: control.rezka_output_kadr_counts, epoch: data.control_state.epoch, revision: data.control_state.rev };
    },
    control: async (): Promise<RezkaOutputControl> => {
      const data = await controlData(), control = data.control_state.control;
      return { stage: control.stage_node_id, allowed: control.allowed_actions,
        fullReport: (props.fullCompletionReportRequired === true || control.complete_requires_full_report !== false) && control.complete_requires_rezka_total_waste_only !== true,
        totalWasteOnly: control.complete_requires_rezka_total_waste_only === true, freezeRequest: runningFreezeRequest(data.control_state, apparatus) ?? undefined };
    },
    save: (body, guard) => adminApparatusQueueActionResult(session, body, guard),
    selectPrinter: () => bridge!.printer(), printerFields: workerPrinterFields,
    reprint: async (frame, printer, count) => {
      if (!current()) throw new Error('worker.error.sync');
      return adminProgressQrReprint(session, { progress_batch_id: frame.batch_id, qr_payload: frame.qr_payload,
        print_count: count, automatic_rezka_labels: true, ...workerPrinterFields(printer) }, current);
    }, print: (result, printer) => printWorkerJobs(result, printer, current), confirm: deviation => bridge!.confirm(deviation),
    attempted: () => callbacks.onAttempted(), committed: final => callbacks.onCommitted(final) });
  return { workflow, options, current, close: (completed = false) => callbacks.onClose(completed), mount: (value: boolean) => { mounted = value; },
    update: (next: Props, nextBridge: Bridge) => { callbacks = next; bridge = nextBridge; } };
}

/** @v2 _ReadOnlyOrderDetailSheetState._runProgressAction */
export function WorkerRezkaOutputReport(props: Props) {
  const [context] = useState(() => props), { session, apparatus, orderId, stage, action, map } = context;
  const owner = useMemo(() => createOwner({ ...context, session, apparatus, orderId, stage, action, map }), [context, session, apparatus, orderId, stage, action, map]);
  const { workflow } = owner, state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot), colors = useWorkerColors(), { p, t } = useWorkerOrderText();
  const selector = useWorkerPrinterSelector(owner.current), [hidden, setHidden] = useState(false), [panel, setPanel] = useState<Panel>({ kind: 'main' }), [reason, setReason] = useState('');
  const [shown, setShown] = useState(Platform.OS !== 'ios');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), cardOffsets = useRef(new Map<number, number>()), fieldOffsets = useRef(new Map<string, number>());
  const modal = useMemo(() => new WorkerReportModalFlow(Platform.OS === 'ios', value => { setHidden(value); setShown(!value && Platform.OS !== 'ios'); }), []);
  const pending = useRef<{ resolve(value: unknown): void; restoreMain: boolean } | null>(null), closing = useRef(false), transition = useRef(false);
  async function showPanel<T>(next: Panel, restoreMain = true): Promise<T | null> {
    if (!owner.current() || pending.current || closing.current || transition.current) return null;
    transition.current = true;
    await modal.hide(); if (!owner.current()) return null;
    return new Promise(resolve => { pending.current = { resolve: value => resolve(value as T | null), restoreMain };
      setReason(''); setPanel(next); transition.current = false; modal.show(); });
  }
  async function finishPanel(value: unknown) {
    if (transition.current || !pending.current) return;
    transition.current = true; const request = pending.current; pending.current = null;
    await modal.hide();
    if (owner.current()) { setPanel({ kind: 'main' }); if (request.restoreMain || value == null || panel.kind === 'discard' && value !== true) modal.show(); }
    transition.current = false; request.resolve(value);
  }
  useLayoutEffect(() => owner.update(props, {
    printer: async () => {
      await modal.hide();
      try { return await pickWorkerPrinter({ current: owner.current, selectDevice: selector.selectDevice }); }
      catch (error) { if (error instanceof WorkerPrintCancelled) throw new Error('worker.rezka.print.printer_not_selected'); throw error; }
      finally { if (owner.current()) modal.show(); }
    },
    confirm: async value => (await showPanel<boolean>({ kind: 'deviation', value })) === true,
  }));
  useEffect(() => {
    owner.mount(true); void workflow.load();
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) { workflow.invalidate(); owner.close(); } });
    return () => { owner.mount(false); unsubscribe(); modal.dispose(); pending.current?.resolve(null); pending.current = null; };
  }, [owner, workflow, modal]);
  useEffect(() => {
    const focus = state.focus;
    if (!focus || !shown || state.confirming || state.queued.includes(focus.index)) return;
    const card = cardOffsets.current.get(focus.index), field = fieldOffsets.current.get(`${focus.index}:${focus.field}`);
    if (card != null && field != null) scroll.current?.scrollTo({ y: Math.max(0, card + field - 24), animated: true });
  }, [state.focus, state.confirming, state.queued, shown]);
  async function close() {
    const latest = workflow.getSnapshot();
    if (closing.current || transition.current || latest.processing || latest.confirming || latest.phase === 'saving') return;
    if (latest.queued.length && (await showPanel<boolean>({ kind: 'discard' }, false)) !== true) return;
    if (closing.current || !owner.current()) return;
    closing.current = true; await modal.hide(); if (owner.current()) owner.close(workflow.getSnapshot().phase === 'done' && workflow.getSnapshot().completed);
  }
  async function issue(index: number, holdOnly = false) {
    if (transition.current || pending.current || closing.current) return;
    let peremotka = holdOnly;
    if (!holdOnly && state.snapshot?.report.peremotka_supported) {
      const choice = await showPanel<boolean>({ kind: 'choice', index }, false); if (choice == null) return; peremotka = choice;
    }
    const note = await showPanel<string>({ kind: 'reason', index, peremotka });
    if (note == null || !owner.current()) return;
    if (peremotka) workflow.enqueue(index, note); else void workflow.saveIssue(index, note);
  }
  const locked = state.phase !== 'edit' || state.syncRequired || state.confirming, saving = state.processing || state.confirming || state.phase === 'saving', main = panel.kind === 'main';
  const title = panel.kind === 'discard' ? p('worker.rezka.print.queue_discard_title') : panel.kind === 'choice' ? p('worker.rezka.print.issue') : panel.kind === 'reason' ? p(panel.peremotka ? 'worker.rezka.print.peremotka_confirm' : 'worker.rezka.print.issue', { index: panel.index + 1 })
    : panel.kind === 'deviation' ? p('worker.rezka.deviation.title') : p(`worker.progress.qty.title.${action === 'complete' ? 'complete' : action}`);
  const confirmLabel = panel.kind === 'deviation' ? p('worker.rezka.deviation.confirm') : panel.kind === 'reason' && panel.peremotka ? p('worker.rezka.print.peremotka_save_print')
    : panel.kind === 'discard' ? p('worker.rezka.print.queue_discard') : main ? state.phase === 'done' || state.phase === 'error' && !state.canReload ? p('worker.action.close') : state.phase === 'error' || state.phase === 'print_pending' ? t('Qayta urinish') : p('worker.action.confirm') : p('worker.action.confirm');
  return <><WorkerFormDialog visible={!hidden} title={title} preventDismiss cancelDisabled={main && saving} scrollRef={scroll}
    cancelLabel={panel.kind === 'deviation' ? p('worker.rezka.deviation.edit') : p('worker.action.cancel')}
    onCancel={() => { if (main) void close(); else void finishPanel(panel.kind === 'deviation' || panel.kind === 'discard' ? false : null); }}
    confirmLabel={confirmLabel} confirmDisabled={panel.kind === 'choice' || (panel.kind === 'reason' ? !reason.trim() || panel.peremotka && [...reason.trim()].length > 250 : main && (saving || state.phase === 'loading'))}
    onConfirm={() => { if (panel.kind === 'deviation' || panel.kind === 'discard') void finishPanel(true); else if (panel.kind === 'reason') void finishPanel(reason.trim());
      else if (state.phase === 'done' || state.phase === 'error' && !state.canReload) void close(); else if (state.phase === 'error') void workflow.load(); else void workflow.submit(); }}
    onDismiss={() => modal.didDismiss()} onShow={() => { modal.didShow(); setShown(true); }}>
    {panel.kind === 'discard' ? <Text style={{ color: colors.text }}>{p('worker.rezka.print.queue_discard_body')}</Text> : panel.kind === 'choice' ? <>
      <WorkerOrderButton label={p('worker.rezka.print.issue_note')} onPress={() => { void finishPanel(false); }} />
      <WorkerOrderButton label={p('worker.rezka.print.peremotka')} onPress={() => { void finishPanel(true); }} />
    </> : panel.kind === 'reason' ? <>
      {!panel.peremotka ? <Text style={{ color: colors.text }}>{p('worker.progress.qty.rezka_output_roll', { index: panel.index + 1, frames: state.snapshot!.kadr_counts[panel.index] })}</Text> : null}
      <WorkerReportField label={p('worker.rezka.print.issue_note')} multiline value={reason} change={setReason} focus={shown ? 1 : undefined} />
    </>
      : panel.kind === 'deviation' ? <View style={{ gap: 12 }}>
        <Text style={{ color: colors.text }}>{p('worker.rezka.deviation.frame', { index: panel.value.index + 1 })}</Text>
        <Text style={{ color: colors.text }}>{p(`worker.daily.field.${panel.value.field === 'kg' ? 'weight' : panel.value.field === 'meter' ? 'length' : 'diameter'}`)}</Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{panel.value.entered} {panel.value.field === 'kg' ? 'kg' : panel.value.field === 'meter' ? 'm' : 'mm'}</Text>
        <Text style={{ color: colors.muted }}>{p('worker.rezka.deviation.reference')}: {panel.value.reference}</Text>
        <Text style={{ color: colors.muted }}>{p('worker.rezka.deviation.difference')}: {panel.value.percent > 0 ? '+' : ''}{Number(panel.value.percent.toFixed(2))}%</Text>
        <Text style={{ color: colors.text }}>{p('worker.rezka.deviation.question')}</Text>
      </View> : <>
        {state.phase === 'loading' || saving ? <ActivityIndicator /> : null}
        {state.error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{p(state.error)}</Text> : null}
        {state.phase === 'done' ? <Text style={{ color: colors.text }}>{p(state.notice || 'worker.rezka.print.saved')}</Text> : null}
        {state.snapshot && state.phase !== 'done' ? <>
          {action === 'complete' && (state.fullReport || state.totalWasteOnly) ? <>
            <Text style={{ color: colors.muted }}>{p(state.totalWasteOnly ? 'worker.daily.field.waste' : 'worker.progress.qty.waste')}</Text>
            {(['total', ...(state.totalWasteOnly ? [] : ['print', 'lamination', 'edge'])] as const).map(key => {
              const field = key as 'total' | 'print' | 'lamination' | 'edge';
              const label = field === 'total' ? state.totalWasteOnly ? 'waste' : 'total_waste' : `${field}_waste`;
              return <WorkerReportField key={field} label={`${p(`worker.daily.field.${label}`)} (kg)`} decimal disabled={locked || saving}
                value={state.waste[field]} change={value => workflow.changeWaste(field, value)} />;
            })}
          </> : null}
          <Text style={{ color: colors.muted }}>{p('worker.progress.qty.rezka_outputs', { count: state.frames.length })}</Text>
          {owner.options.printCount === 2 ? <Text style={{ color: colors.muted }}>{p('worker.rezka.print.duplicate_labels')}</Text> : null}
          <Text style={{ color: colors.muted }}>{p(state.snapshot.report.frames.some(frame => rezkaFrameIssueNote(frame)) ? 'worker.rezka.print.progress_with_issues' : 'worker.rezka.print.progress', {
            issues: state.snapshot.report.frames.filter(frame => rezkaFrameIssueNote(frame)).length,
            healthy: state.snapshot.report.frames.filter(frame => !rezkaFrameIssueNote(frame)).length, saved: state.snapshot.report.frames.length,
            total: state.frames.length, pending: state.frames.length - state.snapshot.report.frames.length,
          })}</Text>
          {state.frames.map((frame, index) => {
            const saved = rezkaFrameAt(state.snapshot!.report, index), savedIssue = !!saved && !!rezkaFrameIssueNote(saved), queued = state.queued.includes(index);
            const editable = !locked && !saved && !queued, retry = state.paused && state.queued[0] === index;
            const output = state.snapshot!.report.layout_outputs[index], status = state.statuses[index] ?? (queued ? 'worker.rezka.print.queued' : saved ? savedIssue ? 'worker.rezka.print.issue_saved' : 'worker.rezka.print.saved' : '');
            const label = `${output ? `${output.name ?? ''} · ${typeof output.width_mm === 'number' ? output.width_mm : ''} mm\n` : ''}${p('worker.progress.qty.rezka_output_roll', { index: index + 1, frames: state.snapshot!.kadr_counts[index] })}`;
            return <View key={index} onLayout={event => { cardOffsets.current.set(index, event.nativeEvent.layout.y); }} style={{ padding: 14, borderRadius: 16, backgroundColor: colors.field, gap: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
              {!state.freezeRequest ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ flex: 1 }}><WorkerOrderButton label={p('worker.rezka.print.issue')} disabled={!editable || saving} onPress={() => { void issue(index); }} /></View>
                <WorkerFramePrint label={p(retry ? 'worker.rezka.print.retry' : saved ? 'worker.rezka.print.reprint' : 'worker.rezka.print.print')}
                  disabled={savedIssue || locked || state.paused && !retry || state.processing && retry || queued && !retry}
                  press={() => { if (!transition.current && !pending.current && !closing.current) workflow.enqueue(index); }} longPress={editable && state.snapshot!.report.peremotka_supported ? () => { void issue(index, true); } : undefined} />
              </View> : null}
              {status ? <Text style={{ color: colors.muted }}>{p(status, { position: state.queued.indexOf(index) + 1 })}</Text> : null}
              {saved && rezkaFramePeremotkaReason(saved) ? <Text style={{ color: colors.error }}>{p('worker.rezka.print.peremotka')} · {rezkaFramePeremotkaReason(saved)}</Text> : null}
              {savedIssue ? <Text style={{ color: colors.error }}>{rezkaFrameIssueNote(saved!)}</Text> : null}
              {(['meter', 'kg', ...(!state.includeBobina || saved?.input.bobina_kg != null ? ['bobina'] : []), 'diameter'] as const).map(key => {
                const field = key as 'meter' | 'kg' | 'bobina' | 'diameter', labelKey = field === 'meter' ? 'length' : field === 'kg' ? 'weight' : field === 'bobina' ? 'roll' : 'diameter';
                return <View key={field} onLayout={event => { fieldOffsets.current.set(`${index}:${field}`, event.nativeEvent.layout.y); }}>
                  <WorkerReportField label={`${p(`worker.daily.field.${labelKey}`)} (${field === 'meter' ? 'm' : field === 'diameter' ? 'mm' : 'kg'})`}
                    decimal value={frame[field]} disabled={!editable} change={value => workflow.change(index, field, value)} focus={shown && state.focus?.index === index && state.focus.field === field ? state.focus.serial : undefined} />
                </View>;
              })}
              {!saved && state.issuePrompted.includes(index) ? <WorkerReportField label={p('worker.freeze.safe_stop.issue_note')} value={frame.note} disabled={!editable} multiline change={value => workflow.change(index, 'note', value)} /> : null}
            </View>;
          })}
          {['complete', 'roll_complete'].includes(action) || state.freezeRequest ? <WorkerReportField label={p('worker.progress.qty.reason')} value={state.note} multiline disabled={locked || saving} change={value => workflow.changeNote(value)} /> : null}
        </> : null}
      </>}
  </WorkerFormDialog>{selector.dialogs}</>;
}
