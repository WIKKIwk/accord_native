import { Button, Host } from '@expo/ui';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { readWorkerActionControl, reactivationTarget, runWorkerMenuAction, workerActionRequest, workerLongPressMenu, type ReactivationTarget, type WorkerMenu, type WorkerMenuAction } from '../workerLongPress';
import type { QueueCursor } from '../workerOrderLogic';
import type { QueueOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import type { WorkerAlertData } from './workerDialogTypes';

type Props = { session: Session; apparatusId: string; apparatusName: string; order: QueueOrder; completed: boolean; getCursor: () => QueueCursor | null; onChoose: (action: 'astatka' | 'complete') => void; onResult: (message: string, showNotice: boolean) => void };
type Reactivation = { target: ReactivationTarget | null; reason: string; stage: string };
const labels: Record<WorkerMenuAction, string> = { temporary_pause: 'Buyurtmani yechib turish', re_pause: 'Qayta pauza qilish', reclose: 'Qayta yopish', astatka: 'Astatka hisobotini topshirish', finish: 'Ishimni tugatish', reopen: 'Rang chiqarilyapti holatiga qaytarish' };
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

export function WorkerLongPressActions({ session, apparatusId, apparatusName, order, completed, getCursor, onChoose, onResult }: Props) {
  const colors = useWorkerColors();
  const close = useContext(WorkerSheetCloseContext);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<WorkerMenu | null>(null);
  const [reactivation, setReactivation] = useState<Reactivation | null>(null);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const loadReactivation = useCallback(async () => {
    const params = new URLSearchParams({ worker_scope: 'true', detail: 'true', apparatus: apparatusId, order_id: order.id });
    const detail = await workerActionRequest(session, `/v1/mobile/admin/production-maps/sequence?${params}`);
    let preview: Record<string, unknown> = {};
    try { preview = await workerActionRequest(session, '/v1/mobile/admin/production-maps/reactivation/preview', { apparatus: apparatusId, order_id: order.id }); } catch { /* Unavailable previews never authorize a write. */ }
    return reactivationTarget(preview, detail, apparatusId, order.id, getCursor());
  }, [session, apparatusId, order.id, getCursor]);

  useEffect(() => {
    mounted.current = true;
    let current = true;
    (async () => {
      try {
        if (completed) {
          const result = await loadReactivation();
          if (current && activeSessionToken(session)) setReactivation(result);
        } else {
          const data = await readWorkerActionControl(session, apparatusId, order.id, getCursor);
          if (!current || !activeSessionToken(session)) return;
          const result = workerLongPressMenu(data, session, apparatusId, order.id, getCursor());
          if (result.kind === 'none') { close?.(); return; }
          if (result.kind === 'astatka') { onChoose('astatka'); close?.(); return; }
          setMenu(result);
        }
      } catch (e) { if (current) setError(e instanceof Error ? e.message : 'Buyurtmani yuklab bo‘lmadi.'); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; mounted.current = false; };
  }, [completed, session, apparatusId, order.id, getCursor, loadReactivation, close, onChoose]);

  async function run(action: WorkerMenuAction) {
    if (!menu || inFlight.current || !activeSessionToken(session)) return;
    inFlight.current = true; setBusy(true);
    let message = '';
    try {
      await runWorkerMenuAction(session, apparatusId, order.id, action, menu, getCursor);
      message = action === 'temporary_pause' ? 'Buyurtma vaqtincha yechildi. Keyin shu rulonni davom ettirishingiz mumkin.' : action === 're_pause' ? 'Ish qayta pauzaga o‘tkazildi.' : action === 'reopen' ? 'Rang chiqarilyapti holatiga qaytarildi.' : 'Ish qayta yopildi. Oldingi hisobotlar saqlandi.';
    } catch { message = 'Amal tasdiqlanmadi. Buyurtmaning joriy holati yangilanmoqda.'; }
    finally { inFlight.current = false; onResult(message, mounted.current); if (mounted.current) { setBusy(false); close?.(); } }
  }
  async function reactivate() {
    if (!reactivation?.target || inFlight.current || !activeSessionToken(session)) return;
    inFlight.current = true; setBusy(true);
    let message = '';
    try {
      const fresh = await loadReactivation();
      if (!fresh.target || JSON.stringify(fresh.target) !== JSON.stringify(reactivation.target)) throw new Error('stale');
      const result = await workerActionRequest(session, '/v1/mobile/admin/production-maps/reactivation', fresh.target);
      if (result.ok !== true) throw new Error('unconfirmed');
      message = 'Ish pauzada qayta ochildi. Ishlash uchun Davom ettirishni bosing.';
    } catch { message = 'Natija tasdiqlanmadi. Joriy holat yangilanmoqda; amal avtomatik takrorlanmaydi.'; }
    finally { inFlight.current = false; onResult(message, mounted.current); if (mounted.current) { setBusy(false); close?.(); } }
  }
  function choose(action: WorkerMenuAction) {
    if (busy) return;
    if (action === 'astatka' || (action === 'finish' && !menu?.actions.includes('reclose'))) {
      onChoose(action === 'astatka' ? 'astatka' : 'complete'); close?.(); return;
    }
    if (action === 'reopen') {
      setAlert({ title: labels.reopen, message: 'Rostdan ham rang chiqarilyapti holatiga qaytarmoqchimisiz?', confirmLabel: 'Ruxsat', onConfirm: () => { void run(action); } });
    } else void run(action);
  }
  function confirmReactivation() {
    if (!reactivation?.target || busy) return;
    const identity = [order.code || order.title, apparatusName, reactivation.stage ? `Bosqich: ${reactivation.stage}` : ''].filter(Boolean).join('\n');
    setAlert({ title: 'Bu bosqich uchun buyurtmani qayta faollashtirish', message: `${identity}\n\nIsh pauzada qaytadi. Oldingi metraj, kilogramm va chiqindi saqlanadi. Davom ettirgach faqat qo‘shimcha ishlab chiqarilgan miqdorni kiriting.`, confirmLabel: 'Qayta faollashtirish', onConfirm: () => { void reactivate(); } });
  }
  const actionButton = (action: WorkerMenuAction, variant: 'filled' | 'outlined' | 'text' = 'outlined') => <Host key={action} matchContents={{ vertical: true }} style={styles.host}><Button label={labels[action]} variant={variant} disabled={busy} onPress={() => choose(action)} /></Host>;

  return <View style={styles.content}>
    {loading && <ActivityIndicator color={colors.icon} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {completed && reactivation && <>
      <Text style={[styles.title, { color: colors.text }]}>{[order.code || order.title, apparatusName, reactivation.stage ? `Bosqich: ${reactivation.stage}` : ''].filter(Boolean).join('\n')}</Text>
      {!reactivation.target && <Text style={[styles.body, { color: colors.muted }]}>{denial[reactivation.reason] ?? denial.unavailable}</Text>}
      <Host matchContents={{ vertical: true }} style={styles.host}><Button label="Bu bosqich uchun buyurtmani qayta faollashtirish" disabled={!reactivation.target || busy} onPress={confirmReactivation} /></Host>
      {!reactivation.target && ['final_stage_closed', 'order_closed'].includes(reactivation.reason) && <Host matchContents={{ vertical: true }} style={styles.host}><Button label="Sababini ko‘rish" variant="text" onPress={() => setAlert({ title: 'Bu bosqich uchun buyurtmani qayta faollashtirish', message: denial[reactivation.reason] ?? denial.unavailable })} /></Host>}
    </>}
    {menu?.kind === 'reopen' && actionButton('reopen')}
    {menu?.kind === 'bosma' && <>
      <Text style={[styles.title, { color: colors.text }]}>Astatka hisobotini topshirish</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Bu amal faqat buyurtma bo‘yicha qoldiqni qayd etadi. Ish jarayoni to‘xtatilmaydi yoki yakunlanmaydi, navbat va WIP holati o‘zgarishsiz qoladi.</Text>
      {menu.actions.filter(action => ['temporary_pause', 're_pause', 'reclose'].includes(action)).map(action => actionButton(action))}
      {actionButton('astatka')}
      {menu.actions.includes('finish') && <><Text style={[styles.body, { color: colors.muted }]}>Bu amal buyurtmaning bosma uskunasidagi ish jarayonini yakunlaydi.</Text>{actionButton('finish', 'filled')}</>}
    </>}
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
  </View>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 }, title: { fontSize: 20, fontWeight: '600', lineHeight: 27 }, body: { fontSize: 14, lineHeight: 20 }, host: { width: '100%' }, error: { color: '#a52626', fontSize: 14 } });
