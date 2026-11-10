import { Image } from 'expo-image';
import qrFactory from 'qrcode-generator';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { CustomerSnackbar } from '../customer/CustomerSnackbar';
import { PreparationReprintCancelled } from '../preparation/preparationReprint';
import { sessionReadScope } from '../sessionReadScope';
import { adminText } from '../shared/localization';
import { reprintWorkerAssignedMaterial } from '../workerAssignedMaterialReprint';
import type { MaterialRow } from '../workerMaterialPresentation';
import { WorkerOrderButton } from './WorkerOrderControls';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';
import { useWorkerPrinterSelector } from './useWorkerPrinterSelector';
Object.assign(qrFactory, { stringToBytes: (text: string) => Array.from(new TextEncoder().encode(text)) });
/** @v2 _showAssignedMaterialReprintSheet */
export function WorkerAssignedMaterialQr({ session, row, onClose }: { session: Session; row: MaterialRow; onClose: () => void }) {
  const { t, locale } = useWorkerOrderText(), colors = useWorkerColors(), close = useContext(WorkerSheetCloseContext) ?? onClose;
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), printing = useRef(false), mounted = useRef(true);
  const [noticeId, setNoticeId] = useState<number | null>(null);
  const dismissNotice = useCallback(() => setNoticeId(null), []);
  const scope = useRef(sessionReadScope(session)), current = () => mounted.current && !!activeSessionToken(session) && scope.current === sessionReadScope(session);
  const printer = useWorkerPrinterSelector(current), barcode = row.barcode?.trim() ?? '';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const qr = useMemo(() => { const code = qrFactory(0, 'M'); code.addData(barcode); code.make(); return code.createDataURL(5, 20); }, [barcode]);
  const details = [['label.item_code', row.item_code], ['label.group', row.item_group], ['label.quantity', (row.stock_qty ?? 0) > 0 ? `${row.stock_qty} ${row.stock_uom ?? ''}`.trim() : ''],
    ['label.warehouse', row.stock_warehouse], ['label.apparatus', row.apparatus], ['label.status', row.stock_status]].filter(([, value]) => value?.trim());
  async function reprint() {
    if (printing.current || !current()) return;
    printing.current = true; setBusy(true); setError('');
    try {
      const warning = await reprintWorkerAssignedMaterial(session, barcode, row.order_id ?? '', { current, selectDevice: printer.selectDevice });
      if (current()) { if (warning) setError(t(warning)); setNoticeId(Date.now()); }
    }
    catch (reason) { if (current() && !(reason instanceof PreparationReprintCancelled)) setError(t(reason instanceof Error && !(reason instanceof TypeError) ? reason.message : adminText('warehouse.qr_print_failed', locale))); }
    finally { printing.current = false; if (current()) setBusy(false); }
  }
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: '600', color: colors.text }}>{t('Chop etilgan QR')}</Text>
    <Text style={{ fontSize: 18, fontWeight: '500', color: colors.text }}>{row.item_name || row.item_code || barcode}</Text>
    <Image source={{ uri: qr }} style={{ width: 224, height: 224, backgroundColor: '#fff', alignSelf: 'center' }} contentFit="contain" accessibilityLabel={barcode} />
    <Text selectable style={{ color: colors.text, textAlign: 'center' }}>{barcode}</Text>
    {details.map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text style={{ color: colors.muted }}>{adminText(label!, locale)}</Text><Text selectable style={{ color: colors.text }}>{value}</Text></View>)}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
    {session.profile.role !== 'sales_manager' && <WorkerOrderButton label={t(busy ? 'Chop etilmoqda…' : 'Qayta chop etish')} disabled={busy} variant="filled" onPress={() => { void reprint(); }} />}
    <WorkerOrderButton label={t('Yopish')} disabled={busy} onPress={close} />
  </ScrollView>{printer.dialogs}<CustomerSnackbar message={noticeId == null ? '' : t('Mavjud QR qayta chop etildi')} messageId={noticeId} onDismiss={dismissNotice} /></View>;
}
