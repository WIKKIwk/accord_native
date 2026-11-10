import { Button, Host } from '@expo/ui';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { readWorkerActionControl, reactivationTarget, runWorkerMenuAction, workerActionRequest, workerLongPressMenu, type ReactivationTarget, type WorkerMenu, type WorkerMenuAction } from '../workerLongPress';
import { adminReactivateCompletedWork, adminWorkReactivationPreview } from '../workerControlsApi';
import type { QueueCursor } from '../workerOrderLogic';
import type { QueueOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerSheetButton, type WorkerSheetIcon } from './WorkerSheetButton';
import { useWorkerOrderText } from './useWorkerOrderText';

export type WorkerActionChoice = 'astatka' | 'complete' | {
  run: (readCursor: () => QueueCursor | null) => Promise<string>;
  confirmation?: Omit<WorkerAlertData, 'onConfirm'>;
};
type Props = { session: Session; apparatusId: string; apparatusName: string; operation: string; order: QueueOrder; completed: boolean; getCursor: () => QueueCursor | null; onChoose: (action: WorkerActionChoice) => void };
type Reactivation = { target: ReactivationTarget | null; reason: string; stage: string };
const labels: Record<WorkerMenuAction, string> = { cancel_start: '', temporary_pause: 'Buyurtmani yechib turish', re_pause: 'Qayta pauza qilish', reclose: 'Qayta yopish', astatka: 'Astatka hisobotini topshirish', finish: 'Ishimni tugatish', reopen: 'Rang chiqarilyapti holatiga qaytarish' };
const icons: Record<WorkerMenuAction, WorkerSheetIcon> = {
  temporary_pause: { android: 'pause_circle', ios: 'pause.circle' }, re_pause: { android: 'pause', ios: 'pause' },
  cancel_start: { android: 'undo', ios: 'arrow.uturn.backward' },
  reclose: { android: 'lock', ios: 'lock' }, astatka: { android: 'assignment', ios: 'doc.text' },
  finish: { android: 'logout', ios: 'rectangle.portrait.and.arrow.right' }, reopen: { android: 'colorize', ios: 'eyedropper' },
};
const denial: Record<string, string> = {
  apparatus_busy: 'Apparatda boshqa ish yoki ish boshlash jarayoni bor. U tugamaguncha qayta faollashtirish mumkin emas.',
  source_not_free: 'Bu ishga bog‘langan WIP ishlatilgan yoki band qilingan. Uni qayta faollashtirish mumkin emas.',
  final_stage_closed: 'Buyurtma oxirgi bosqichda yakuniy yopilgan. Bu oynadan qayta faollashtirish mumkin emas.',
  stale_target: 'Ish yoki production map holati o‘zgargan. Ro‘yxatni yangilab qayta tekshiring.',
  resource_unavailable: 'Kerakli material yoki qolip mavjud emas yoki boshqa ishda band.',
  order_closed: 'Buyurtma yopilgan, bekor qilingan yoki faol ishlashga ruxsat berilmagan.',
  unsupported_history: 'Bu ish tarixini qayta faollashtirish qo‘llab-quvvatlanmaydi.',
  unavailable: 'Qayta faollashtirish hozir mumkin emas.',
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
  const chosen = useRef(false);

  const loadReactivation = useCallback(async (readCursor = getCursor) => {
    const params = new URLSearchParams({ worker_scope: 'true', detail: 'true', apparatus: apparatusId, order_id: order.id });
    const detail = await workerActionRequest(session, `/v1/mobile/admin/production-maps/sequence?${params}`);
    let preview: Record<string, unknown> = {};
    try { preview = await adminWorkReactivationPreview(session, apparatusId, order.id); } catch { /* Unavailable previews never authorize a write. */ }
    return reactivationTarget(preview, detail, apparatusId, order.id, readCursor());
  }, [session, apparatusId, order.id, getCursor]);

  useEffect(() => {
    let current = true;
    (async () => {
      try {
        if (completed) {
          const result = await loadReactivation();
          if (current && activeSessionToken(session)) setReactivation(result);
        } else {
          const data = await readWorkerActionControl(session, apparatusId, order.id, getCursor);
          if (!current || !activeSessionToken(session)) return;
          const result = workerLongPressMenu(data, session, apparatusId, order.id, getCursor(), operation);
          if (result.kind === 'none') { close?.(); return; }
          if (result.kind === 'astatka') { onChoose('astatka'); close?.(); return; }
          setMenu(result);
        }
      } catch (e) { if (current) setError(e instanceof Error ? e.message : 'Buyurtmani yuklab bo‘lmadi.'); }
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
    if (action === 'astatka' || (action === 'finish' && !menu.actions.includes('reclose'))) {
      pick(action === 'astatka' || menu.operation !== 'print' ? 'astatka' : 'complete');
      return;
    }
    pick({
      confirmation: action === 'cancel_start' ? { title: p('worker.cancel_start.title'), message: p('worker.cancel_start.message'),
        confirmLabel: p('worker.cancel_start.confirm'), cancelLabel: p('worker.cancel_start.back') }
        : action === 'reopen' ? { title: labels.reopen, message: 'Rostdan ham rang chiqarilyapti holatiga qaytarmoqchimisiz?', confirmLabel: 'Ruxsat' } : undefined,
      run: async readCursor => {
        if (action === 'cancel_start') {
          try { await runWorkerMenuAction(session, apparatusId, order.id, action, menu, readCursor); return p('worker.cancel_start.success'); }
          catch { return p('worker.cancel_start.failed'); }
        }
        await runWorkerMenuAction(session, apparatusId, order.id, action, menu, readCursor);
        if (action === 'temporary_pause') return 'Buyurtma vaqtincha yechildi. Keyin shu rulonni davom ettirishingiz mumkin.';
        if (action === 're_pause') return 'Ish qayta pauzaga o‘tkazildi.';
        return action === 'reopen' ? '' : 'Ish qayta yopildi. Oldingi hisobotlar saqlandi.';
      },
    });
  }

  function confirmReactivation() {
    if (!reactivation?.target) return;
    const target = reactivation.target;
    const identity = [order.code || order.title, apparatusName, reactivation.stage ? `Bosqich: ${reactivation.stage}` : ''].filter(Boolean).join('\n');
    pick({
      confirmation: {
        title: 'Bu bosqich uchun buyurtmani qayta faollashtirish',
        message: `${identity}\n\nIsh pauzada qaytadi. Oldingi metraj, kilogramm va chiqindi saqlanadi. Davom ettirgach faqat qo‘shimcha ishlab chiqarilgan miqdorni kiriting.`,
        confirmLabel: 'Qayta faollashtirish',
      },
      run: async readCursor => {
        const fresh = await loadReactivation(readCursor);
        if (!fresh.target || JSON.stringify(fresh.target) !== JSON.stringify(target)) throw new Error('Buyurtma holati o‘zgardi.');
        await adminReactivateCompletedWork(session, fresh.target);
        return 'Ish pauzada qayta ochildi. Ishlash uchun Davom ettirishni bosing.';
      },
    });
  }
  const actionButton = (action: WorkerMenuAction, variant: 'filled' | 'outlined' = 'outlined') =>
    <WorkerSheetButton key={action} label={action === 'cancel_start' ? p('worker.cancel_start.action') : labels[action]} variant={variant} icon={icons[action]} onPress={() => choose(action)} />;

  return <View style={styles.content}>
    {Platform.OS === 'ios' && <View style={styles.header}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: colors.text }]}>Amallar</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{[order.code, order.title].filter(Boolean).join(' · ')}</Text>
      </View>
      <WorkerIconButton icon="close" label="Yopish" onPress={() => close?.()} tonal />
    </View>}
    {loading && <ActivityIndicator color={colors.icon} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {completed && reactivation && <>
      <Text style={[styles.title, { color: colors.text }]}>{[order.code || order.title, apparatusName, reactivation.stage ? `Bosqich: ${reactivation.stage}` : ''].filter(Boolean).join('\n')}</Text>
      {!reactivation.target && <Text style={[styles.body, { color: colors.muted }]}>{denial[reactivation.reason] ?? denial.unavailable}</Text>}
      <WorkerSheetButton label="Bu bosqich uchun buyurtmani qayta faollashtirish" variant="filled"
        icon={{ android: 'restart_alt', ios: 'arrow.counterclockwise' }} disabled={!reactivation.target} onPress={confirmReactivation} />
      {!reactivation.target && ['final_stage_closed', 'order_closed'].includes(reactivation.reason) && <Host matchContents={{ vertical: true }} style={styles.host}><Button label="Sababini ko‘rish" variant="text" onPress={() => setAlert({ title: 'Bu bosqich uchun buyurtmani qayta faollashtirish', message: denial[reactivation.reason] ?? denial.unavailable })} /></Host>}
    </>}
    {menu?.kind === 'reopen' && actionButton('reopen')}
    {menu?.kind === 'report' && <>
      <Text style={[styles.title, { color: colors.text }]}>{p(operation === 'cut' ? 'worker.rezka.astatka.title' : 'worker.laminatsiya.astatka.title')}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{p(operation === 'laminate' ? 'worker.lamination_astatka.description' : 'worker.finish.description')}</Text>
      {menu.actions.filter(action => ['cancel_start', 'temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      <WorkerSheetButton label={p(menu.actions.includes('reclose') ? 'worker.action.complete' : operation === 'cut' ? 'worker.rezka.astatka.title' : 'worker.laminatsiya.astatka.title')}
        variant="filled" icon={icons.finish} onPress={() => choose('finish')} />
    </>}
    {menu?.kind === 'bosma' && <>
      <Text style={[styles.title, { color: colors.text }]}>Astatka hisobotini topshirish</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Bu amal faqat buyurtma bo‘yicha qoldiqni qayd etadi. Ish jarayoni to‘xtatilmaydi yoki yakunlanmaydi, navbat va WIP holati o‘zgarishsiz qoladi.</Text>
      {menu.actions.filter(action => ['cancel_start', 'temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      {actionButton('astatka')}
      {menu.actions.includes('finish') && <><Text style={[styles.body, { color: colors.muted }]}>Bu amal buyurtmaning bosma uskunasidagi ish jarayonini yakunlaydi.</Text>{actionButton('finish', 'filled')}</>}
    </>}
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
  </View>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heading: { flex: 1 }, title: { fontSize: 20, fontWeight: '600', lineHeight: 27 }, body: { fontSize: 14, lineHeight: 20 }, host: { width: '100%' }, error: { color: '#a52626', fontSize: 14 } });
