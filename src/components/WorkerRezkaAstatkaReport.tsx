import { randomUUID } from 'expo-crypto';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Text } from 'react-native';
import { activeSessionToken, subscribeSessionWitness, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { adminRezkaAstatkaReport, adminRezkaAstatkaSnapshot } from '../rezkaAstatkaApi';
import { readWorkerActionControl } from '../workerLongPress';
import type { QueueCursor } from '../workerOrderLogic';
import { workerReportPendingStore } from '../workerReportPendingStore';
import { WorkerRezkaAstatkaWorkflow, type RezkaAstatkaValues } from '../workerRezkaAstatkaWorkflow';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';

type Props = { session: Session; apparatus: string; orderId: string; getCursor(): QueueCursor | null; onAttempted(): void; onCommitted(): void; onClose(completed: boolean): void };
function createOwner(session: Session, apparatus: string, orderId: string) {
  let mounted = false, callbacks: Props | null = null;
  const scope = sessionReadScope(session), current = () => mounted && !!activeSessionToken(session) && scope === sessionReadScope(session);
  const key = JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref, apparatus, orderId, 'rezka_astatka']);
  const workflow = new WorkerRezkaAstatkaWorkflow({ context: { apparatus, orderId }, key, current, newRequestId: () => `rezka-astatka-${randomUUID()}`,
    read: request_id => adminRezkaAstatkaSnapshot(session, { apparatus, order_id: orderId, request_id }, current),
    control: async () => {
      const data = await readWorkerActionControl(session, apparatus, orderId, () => callbacks?.getCursor() ?? null);
      if (!current() || !data.control_state?.control) throw new Error('worker.rezka_astatka.changed');
      const control = data.control_state.control;
      return { stage: String(control.stage_node_id ?? ''), totalWasteOnly: control.rezka_total_waste_only === true };
    },
    save: (request, guard) => adminRezkaAstatkaReport(session, request, guard), store: workerReportPendingStore,
    attempted: () => callbacks?.onAttempted(), committed: () => callbacks?.onCommitted() });
  return { workflow, current, close: () => callbacks?.onClose(current() && workflow.getSnapshot().phase === 'done'), update: (next: Props) => { callbacks = next; }, mount: (value: boolean) => { mounted = value; } };
}

/** @v2 _ReadOnlyOrderDetailSheetState._runRezkaAstatkaReport */
export function WorkerRezkaAstatkaReport(props: Props) {
  const { session, apparatus, orderId } = props, colors = useWorkerColors(), { p, t } = useWorkerOrderText();
  const owner = useMemo(() => createOwner(session, apparatus, orderId), [session, apparatus, orderId]), { workflow } = owner;
  useLayoutEffect(() => owner.update(props), [owner, props]);
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, workflow.getSnapshot);
  const [hidden, setHidden] = useState(false), closing = useRef(false), dismissed = useRef<(() => void) | null>(null);
  useEffect(() => {
    owner.mount(true); void workflow.load();
    const unsubscribe = subscribeSessionWitness(() => { if (!owner.current()) { workflow.invalidate(); owner.close(); } });
    return () => { owner.mount(false); unsubscribe(); dismissed.current?.(); dismissed.current = null; };
  }, [owner, workflow]);
  async function close() {
    if (closing.current || workflow.getSnapshot().phase === 'saving') return;
    closing.current = true;
    if (Platform.OS === 'ios') await new Promise<void>(resolve => { dismissed.current = resolve; setHidden(true); });
    else setHidden(true);
    if (owner.current()) owner.close();
  }
  const edit = state.phase === 'edit', done = state.phase === 'done', loading = state.phase === 'loading', saving = state.phase === 'saving';
  const field = (key: keyof RezkaAstatkaValues, label: string) => <WorkerFormField key={key} label={`${p(label)}${key === 'note' ? '' : ' (kg)'}`}
    initialValue={state.values[key]} keyboardType={key === 'note' ? 'default' : 'decimal-pad'} onChangeText={value => workflow.change(key, value)} />;
  return <WorkerFormDialog visible={!hidden} title={p('worker.rezka.astatka.title')} cancelLabel={p('worker.action.close')}
    onCancel={() => { void close(); }} cancelDisabled={saving} preventDismiss
    confirmLabel={done ? p('worker.action.close') : state.phase === 'error' ? t('Qayta urinish') : state.phase === 'pending' ? p('worker.layer_remainder.retry') : t('Saqlash')}
    confirmDisabled={loading || saving} onDismiss={() => { dismissed.current?.(); dismissed.current = null; }}
    onConfirm={() => { if (done) void close(); else if (state.phase === 'error') void workflow.load(); else void workflow.submit(); }}>
    {loading || saving ? <ActivityIndicator /> : null}
    {state.error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{p(state.error)}</Text> : null}
    {state.phase === 'pending' ? <Text style={{ color: colors.text }}>{p('worker.rezka_astatka.pending')}</Text> : null}
    {done ? <Text style={{ color: colors.text }}>{p('worker.notice.astatka_recorded')}</Text> : null}
    {edit ? <>
      {field('total', state.totalWasteOnly ? 'worker.daily.field.waste' : 'worker.daily.field.total_waste')}
      {!state.totalWasteOnly ? <>{field('print', 'worker.daily.field.print_waste')}{field('lamination', 'worker.daily.field.lamination_waste')}{field('edge', 'worker.daily.field.edge_waste')}</> : null}
      {field('note', 'worker.progress.qty.optional_note')}
    </> : null}
  </WorkerFormDialog>;
}
