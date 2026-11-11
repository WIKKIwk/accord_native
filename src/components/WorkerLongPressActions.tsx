import { Button, Host } from '@expo/ui';
import { useContext, useRef, useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, captureSessionWitness, isSessionWitnessCurrent, type Session } from '../auth';
import { runWorkerMenuAction, type WorkerMenuAction } from '../workerLongPress';
import type { WorkerPreparedActionSheet } from '../workerLongPressPreparation';
import { runWorkerWipReactivation, workerReactivationDenialKey } from '../workerWipReactivation';
import type { QueueCursor } from '../workerOrderLogic';
import type { QueueOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerIconButton } from './WorkerIconButton';
import type { WorkerSheetIcon } from './WorkerSheetButton';
import { WorkerOrderButton as WorkerSheetButton } from './WorkerOrderControls';
import { useWorkerOrderText } from './useWorkerOrderText';
import { sessionReadScope } from '../sessionReadScope';

export type WorkerActionChoice = 'astatka' | 'complete' | 'resume' | 'detach_roll' | {
  run: (readCursor: () => QueueCursor | null) => Promise<string>;
  confirmation?: Omit<WorkerAlertData, 'onConfirm'>;
};
type Props = { session: Session; apparatusId: string; operation: string; order: QueueOrder; prepared: WorkerPreparedActionSheet; onChoose: (action: WorkerActionChoice) => void };
const labels: Record<WorkerMenuAction, string> = { cancel_start: '', temporary_pause: 'worker.temporary_pause.action', re_pause: 'worker.re_pause.action', reclose: 'worker.reclose.action', astatka: 'worker.bosma.astatka.title', finish: 'worker.finish.title', reopen: 'worker.print_preflight.reopen.action', resume: '', detach_roll: '' };
const icons: Record<WorkerMenuAction, WorkerSheetIcon> = {
  temporary_pause: { android: 'pause_circle', ios: 'pause.circle' }, re_pause: { android: 'pause', ios: 'pause' },
  cancel_start: { android: 'undo', ios: 'arrow.uturn.backward' },
  reclose: { android: 'lock', ios: 'lock' }, astatka: { android: 'assignment', ios: 'doc.text' },
  finish: { android: 'logout', ios: 'rectangle.portrait.and.arrow.right' }, reopen: { android: 'colorize', ios: 'eyedropper' },
  resume: { android: 'play_arrow', ios: 'play.fill' }, detach_roll: { android: 'unarchive', ios: 'archivebox' },
};
const actionTints: Record<WorkerMenuAction, ComponentProps<typeof WorkerSheetButton>['orderAction']> = {
  temporary_pause: 'pause', re_pause: 'pause', cancel_start: 'pause', detach_roll: 'pause',
  finish: 'complete', reclose: 'complete', astatka: 'report', resume: 'resume', reopen: 'start',
};

/** @v2 _BosmaWorkerFinishSheet */
export function WorkerLongPressActions({ session, apparatusId, operation, order, prepared, onChoose }: Props) {
  const colors = useWorkerColors();
  const titleStyle = [styles.title, Platform.OS === 'ios' && iosStyles.title, { color: colors.text }];
  const bodyStyle = [styles.body, Platform.OS === 'ios' && iosStyles.body, { color: colors.muted }];
  const { p } = useWorkerOrderText();
  const close = useContext(WorkerSheetCloseContext);
  const menu = prepared.kind === 'menu' ? prepared.menu : null;
  const reactivation = prepared.kind === 'reactivation' ? prepared.reactivation : null;
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const chosen = useRef(false);

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
    <WorkerSheetButton key={action} label={action === 'cancel_start' ? p('worker.cancel_start.action') : p(labels[action])} orderAction={actionTints[action]} variant={variant} icon={icons[action]} onPress={() => choose(action)} />;

  return <View style={[styles.content, Platform.OS === 'ios' && iosStyles.content]}>
    {Platform.OS === 'ios' && <View style={styles.header}>
      <View style={styles.heading}>
        {order.code ? <Text style={[iosStyles.orderCode, { color: colors.text }]}>{order.code}</Text> : null}
        {order.title ? <Text numberOfLines={2} style={[iosStyles.orderTitle, { color: colors.muted }]}>{order.title}</Text> : null}
      </View>
      <WorkerIconButton icon="close" label={p('worker.action.close')} onPress={() => close?.()} tonal neutralIcon />
    </View>}
    {reactivation && <>
      <Text style={titleStyle}>{reactivation.identity}</Text>
      {!reactivation.target && <Text style={bodyStyle}>{p(workerReactivationDenialKey(reactivation.reason))}</Text>}
      <WorkerSheetButton label={p(reactivation.actionKey)} variant="filled" orderAction="resume"
        icon={{ android: 'restart_alt', ios: 'arrow.counterclockwise' }} disabled={!reactivation.target} onPress={confirmReactivation} />
      {!reactivation.target && ['final_stage_closed', 'order_closed'].includes(reactivation.reason) && <Host matchContents={{ vertical: true }} style={styles.host}><Button label={p('worker.reactivate.reason_details')} variant="text" onPress={() => setAlert({ title: p(reactivation.actionKey), message: p(workerReactivationDenialKey(reactivation.reason)), confirmLabel: p('worker.action.close') })} /></Host>}
    </>}
    {menu?.kind === 'reopen' && actionButton('reopen')}
    {menu?.kind === 'handoff' && <>
      <Text style={titleStyle}>{p('worker.handoff.title')}</Text>
      <Text style={bodyStyle}>{p('worker.handoff.description')}</Text>
      <WorkerSheetButton label={p('worker.handoff.continue')} orderAction="resume" variant="filled" icon={icons.resume} onPress={() => choose('resume')} />
      <WorkerSheetButton label={p('worker.handoff.detach')} orderAction="pause" icon={icons.detach_roll} onPress={() => choose('detach_roll')} />
      {menu.actions.includes('astatka') && actionButton('astatka')}
    </>}
    {menu?.kind === 'report' && <>
      <Text style={titleStyle}>{p(operation === 'cut' ? 'worker.rezka.astatka.title' : 'worker.laminatsiya.astatka.title')}</Text>
      <Text style={bodyStyle}>{p(operation === 'laminate' ? 'worker.lamination_astatka.description' : 'worker.finish.description')}</Text>
      {menu.actions.filter(action => ['cancel_start', 'temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      <WorkerSheetButton label={p(menu.actions.includes('reclose') ? 'worker.action.complete' : operation === 'cut' ? 'worker.rezka.astatka.title' : 'worker.laminatsiya.astatka.title')}
        orderAction={menu.actions.includes('reclose') ? 'complete' : 'report'} variant="filled" icon={icons.finish} onPress={() => choose('finish')} />
    </>}
    {menu?.kind === 'bosma' && <>
      <Text style={titleStyle}>{p('worker.bosma.astatka.title')}</Text>
      <Text style={bodyStyle}>{p('worker.finish.description')}</Text>
      {menu.actions.filter(action => ['cancel_start', 'temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      {actionButton('astatka')}
      {menu.actions.includes('finish') && <View style={Platform.OS === 'ios' ? [iosStyles.finishSection, { borderTopColor: colors.muted }] : styles.finishSection}>
        <Text style={bodyStyle}>{p('worker.bosma.finish.description')}</Text>{actionButton('finish', 'filled')}
      </View>}
    </>}
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
  </View>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heading: { flex: 1, gap: 4 }, title: { fontSize: 20, fontWeight: '600', lineHeight: 27 }, body: { fontSize: 14, lineHeight: 20 }, host: { width: '100%' }, finishSection: { gap: 12 } });
const iosStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  orderCode: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  orderTitle: { fontSize: 17, lineHeight: 23, fontWeight: '500' },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '600' }, body: { fontSize: 15, lineHeight: 21 },
  finishSection: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
