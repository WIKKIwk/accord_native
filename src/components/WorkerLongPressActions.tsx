import { Button, Host } from '@expo/ui';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, type Session } from '../auth';
import { readWorkerActionControl, runWorkerMenuAction, workerLongPressMenu, type WorkerMenu, type WorkerMenuAction } from '../workerLongPress';
import { workerProductionOrderDetail } from '../workerDetailApi';
import { prepareWorkerWipReactivation, runWorkerWipReactivation, workerReactivationDenialKey, type WorkerWipReactivationReview } from '../workerWipReactivation';
import type { QueueCursor } from '../workerOrderLogic';
import type { QueueOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerSheetButton, type WorkerSheetIcon } from './WorkerSheetButton';
import { useWorkerOrderText } from './useWorkerOrderText';
import { adminWipBatches } from '../workerWipApi';
import { workerHandoffBatch } from '../workerHandoff';
import { sessionReadScope } from '../sessionReadScope';

export type WorkerActionChoice = 'astatka' | 'complete' | 'resume' | 'detach_roll' | {
  run: (readCursor: () => QueueCursor | null) => Promise<string>;
  confirmation?: Omit<WorkerAlertData, 'onConfirm'>;
};
type Props = { session: Session; apparatusId: string; apparatusName: string; operation: string; order: QueueOrder; completed: boolean; getCursor: () => QueueCursor | null; onChoose: (action: WorkerActionChoice) => void };
type Reactivation = WorkerWipReactivationReview;
const labels: Record<WorkerMenuAction, string> = { cancel_start: '', temporary_pause: 'worker.temporary_pause.action', re_pause: 'worker.re_pause.action', reclose: 'worker.reclose.action', astatka: 'worker.bosma.astatka.title', finish: 'worker.finish.title', reopen: 'worker.print_preflight.reopen.action', resume: '', detach_roll: '' };
const icons: Record<WorkerMenuAction, WorkerSheetIcon> = {
  temporary_pause: { android: 'pause_circle', ios: 'pause.circle' }, re_pause: { android: 'pause', ios: 'pause' },
  cancel_start: { android: 'undo', ios: 'arrow.uturn.backward' },
  reclose: { android: 'lock', ios: 'lock' }, astatka: { android: 'assignment', ios: 'doc.text' },
  finish: { android: 'logout', ios: 'rectangle.portrait.and.arrow.right' }, reopen: { android: 'colorize', ios: 'eyedropper' },
  resume: { android: 'play_arrow', ios: 'play.fill' }, detach_roll: { android: 'unarchive', ios: 'archivebox' },
};


export function WorkerLongPressActions({ session, apparatusId, apparatusName, operation, order, completed, getCursor, onChoose }: Props) {
  const colors = useWorkerColors();
  const { p } = useWorkerOrderText();
  const close = useContext(WorkerSheetCloseContext);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<WorkerMenu | null>(null);
  const [reactivation, setReactivation] = useState<Reactivation | null>(null);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const chosen = useRef(false), text = useRef(p);
  useLayoutEffect(() => { text.current = p; }, [p]);

  const loadReactivation = useCallback(async () => {
    const scope = sessionReadScope(session), witness = captureSessionWitness(session);
    const current = () => !!activeSessionToken(session) && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope;
    let map: Record<string, any> = { id: order.id, code: order.code, title: order.title };
    try { const detail = await workerProductionOrderDetail(session, apparatusId, order.id); map = detail.maps[0].map; } catch { /* A partial local map cannot enable the action. */ }
    return prepareWorkerWipReactivation(session, { apparatus: { id: apparatusId, name: apparatusName, operation }, map, workerMode: true, allowReactivation: true }, text.current, current);
  }, [session, apparatusId, apparatusName, operation, order.id, order.code, order.title]);

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        if (completed) {
          const result = await loadReactivation();
          if (current && activeSessionToken(session)) { if (result) setReactivation(result); else close?.(); }
        } else {
          const data = await readWorkerActionControl(session, apparatusId, order.id, getCursor);
          if (!current || !activeSessionToken(session)) return;
          let result = workerLongPressMenu(data, session, apparatusId, order.id, getCursor(), operation);
          if (result.kind === 'none') { close?.(); return; }
          if (['laminate', 'glue'].includes(operation) && result.control.state === 'paused' && !result.actions.includes('reclose')) {
            const batches = await adminWipBatches(session, { status: 'all', apparatus: apparatusId, orderId: order.id, limit: 250 });
            if (!current || !activeSessionToken(session) || result.readScope !== sessionReadScope(session)) return;
            if (workerHandoffBatch(batches, apparatusId, order.id)) result = { ...result, kind: 'handoff', actions: ['resume', 'detach_roll', ...(operation === 'laminate' ? ['astatka' as const] : [])] };
          }
          if (result.kind === 'astatka') { onChoose('astatka'); close?.(); return; }
          setMenu(result);
        }
      } catch (e) { if (current) setError(e instanceof Error ? e.message : 'worker.error.sync'); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [completed, session, apparatusId, order.id, operation, getCursor, loadReactivation, close, onChoose]);

  function pick(choice: WorkerActionChoice) {
    if (chosen.current || !activeSessionToken(session)) return;
    chosen.current = true;
    onChoose(choice);
    close?.();
  }

  function choose(action: WorkerMenuAction) {
    if (!menu) return;
    if (action === 'resume' || action === 'detach_roll') { pick(action); return; }
    if (action === 'astatka' || (action === 'finish' && !menu.actions.includes('reclose'))) {
      pick(action === 'astatka' || menu.operation !== 'print' ? 'astatka' : 'complete');
      return;
    }
    pick({
      confirmation: action === 'cancel_start' ? { title: p('worker.cancel_start.title'), message: p('worker.cancel_start.message'),
        confirmLabel: p('worker.cancel_start.confirm'), cancelLabel: p('worker.cancel_start.back') }
        : action === 'reopen' ? { title: p(labels.reopen), message: p('worker.print_preflight.reopen.message'), confirmLabel: p('worker.print_preflight.reopen.confirm'), cancelLabel: p('worker.print_preflight.reopen.cancel') } : undefined,
      run: async readCursor => {
        if (action === 'cancel_start') {
          try { await runWorkerMenuAction(session, apparatusId, order.id, action, menu, readCursor); return p('worker.cancel_start.success'); }
          catch { return p('worker.cancel_start.failed'); }
        }
        await runWorkerMenuAction(session, apparatusId, order.id, action, menu, readCursor);
        if (action === 'temporary_pause') return p('worker.temporary_pause.success');
        if (action === 're_pause') return p('worker.re_pause.success');
        return action === 'reopen' ? '' : p('worker.reclose.success');
      },
    });
  }

  function confirmReactivation() {
    if (!reactivation?.target) return;
    const review = reactivation;
    const scope = sessionReadScope(session), witness = captureSessionWitness(session);
    pick({
      confirmation: {
        title: p(review.actionKey), message: `${review.identity}\n\n${p(review.explanationKey)}`,
        confirmLabel: p('worker.reactivate.confirm'), cancelLabel: p('worker.action.cancel'),
      },
      run: async () => {
        const outcome = await runWorkerWipReactivation(session, review, () => !!activeSessionToken(session) && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope);
        if (!outcome.attempted) return '';
        return outcome.succeeded ? p('worker.reactivate.success') : `${p(workerReactivationDenialKey(outcome.reason))}\n${p('worker.reactivate.unconfirmed')}`;
      },
    });
  }
  const actionButton = (action: WorkerMenuAction, variant: 'filled' | 'outlined' = 'outlined') =>
    <WorkerSheetButton key={action} label={action === 'cancel_start' ? p('worker.cancel_start.action') : p(labels[action])} variant={variant} icon={icons[action]} onPress={() => choose(action)} />;

  return <View style={styles.content}>
    {Platform.OS === 'ios' && <View style={styles.header}>
      <View style={styles.heading}>
        <Text style={[styles.body, { color: colors.muted }]}>{[order.code, order.title].filter(Boolean).join(' · ')}</Text>
      </View>
      <WorkerIconButton icon="close" label={p('worker.action.close')} onPress={() => close?.()} tonal />
    </View>}
    {loading && <ActivityIndicator color={colors.icon} />}
    {!!error && <Text style={styles.error}>{p(error)}</Text>}
    {completed && reactivation && <>
      <Text style={[styles.title, { color: colors.text }]}>{reactivation.identity}</Text>
      {!reactivation.target && <Text style={[styles.body, { color: colors.muted }]}>{p(workerReactivationDenialKey(reactivation.reason))}</Text>}
      <WorkerSheetButton label={p(reactivation.actionKey)} variant="filled"
        icon={{ android: 'restart_alt', ios: 'arrow.counterclockwise' }} disabled={!reactivation.target} onPress={confirmReactivation} />
      {!reactivation.target && ['final_stage_closed', 'order_closed'].includes(reactivation.reason) && <Host matchContents={{ vertical: true }} style={styles.host}><Button label={p('worker.reactivate.reason_details')} variant="text" onPress={() => setAlert({ title: p(reactivation.actionKey), message: p(workerReactivationDenialKey(reactivation.reason)), confirmLabel: p('worker.action.close') })} /></Host>}
    </>}
    {menu?.kind === 'reopen' && actionButton('reopen')}
    {menu?.kind === 'handoff' && <>
      <Text style={[styles.title, { color: colors.text }]}>{p('worker.handoff.title')}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{p('worker.handoff.description')}</Text>
      <WorkerSheetButton label={p('worker.handoff.continue')} variant="filled" icon={icons.resume} onPress={() => choose('resume')} />
      <WorkerSheetButton label={p('worker.handoff.detach')} icon={icons.detach_roll} onPress={() => choose('detach_roll')} />
      {menu.actions.includes('astatka') && actionButton('astatka')}
    </>}
    {menu?.kind === 'report' && <>
      <Text style={[styles.title, { color: colors.text }]}>{p(operation === 'cut' ? 'worker.rezka.astatka.title' : 'worker.laminatsiya.astatka.title')}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{p(operation === 'laminate' ? 'worker.lamination_astatka.description' : 'worker.finish.description')}</Text>
      {menu.actions.filter(action => ['cancel_start', 'temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      <WorkerSheetButton label={p(menu.actions.includes('reclose') ? 'worker.action.complete' : operation === 'cut' ? 'worker.rezka.astatka.title' : 'worker.laminatsiya.astatka.title')}
        variant="filled" icon={icons.finish} onPress={() => choose('finish')} />
    </>}
    {menu?.kind === 'bosma' && <>
      <Text style={[styles.title, { color: colors.text }]}>{p('worker.bosma.astatka.title')}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{p('worker.finish.description')}</Text>
      {menu.actions.filter(action => ['cancel_start', 'temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      {actionButton('astatka')}
      {menu.actions.includes('finish') && <><Text style={[styles.body, { color: colors.muted }]}>{p('worker.bosma.finish.description')}</Text>{actionButton('finish', 'filled')}</>}
    </>}
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
  </View>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heading: { flex: 1 }, title: { fontSize: 20, fontWeight: '600', lineHeight: 27 }, body: { fontSize: 14, lineHeight: 20 }, host: { width: '100%' }, error: { color: '#a52626', fontSize: 14 } });
