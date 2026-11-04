import { Button, Column, Host } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useContext, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, FlatList, Platform, PlatformColor, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { useNativeSheet } from '../nativeSheet';
import type { CompletedOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { loadWorkerWipBatches, wipBatchKind, wipBatchRows, wipBatchStatus, wipBatchWeights, wipMeters, wipText, type WipApparatusNames, type WipBatch, type WipOrder } from '../workerWip';
import { WorkerWipBatchDetails } from './WorkerWipBatchDetails';

type Props = { session: Session; order: WipOrder; onClose: () => void; stageHistory?: boolean; apparatusNames?: WipApparatusNames };
export type WorkerWipHistorySheetHandle = { open: (order: CompletedOrder) => void };

export function WorkerWipHistorySheet({ ref, session, onDismiss }: {
  ref: Ref<WorkerWipHistorySheetHandle>;
  session: Session;
  onDismiss: () => void;
}) {
  const [order, setOrder] = useState<CompletedOrder | null>(null);
  useImperativeHandle(ref, () => ({ open: setOrder }), []);
  if (!order) return null;
  const close = () => {
    setOrder(null);
    onDismiss();
  };
  return <WorkerOrderSheet key={JSON.stringify([order.apparatusId, order.id])} dismissible onClose={close}>
    <WorkerWipHistory session={session} order={order} onClose={close} />
  </WorkerOrderSheet>;
}

async function loadOpeningWip(session: Session, order: WipOrder, signal: AbortSignal): Promise<WipBatch[]> {
  const query = new URLSearchParams({ order_id: order.id, status: 'all', limit: '500' });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/opening-wip?${query}`, { signal });
  if (!response.ok) throw new Error(`Opening WIP yuklanmadi (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload.records)) throw new Error('Opening WIP javobi noto‘g‘ri.');
  return payload.records.flatMap((record: WipBatch) => {
    const intake = record.intake;
    const source = wipText(intake?.source_apparatus) || wipText(intake?.entry_apparatus);
    if (intake?.order_id !== order.id || source !== order.apparatusId || !Array.isArray(record.batches)) return [];
    return record.batches.filter((batch: WipBatch) => wipText(batch.batch_id) && wipText(batch.wip_status).toLowerCase() !== 'void')
      .map((batch: WipBatch) => ({ ...batch, apparatus: source, produced_qty: batch.quantity,
        current_location: intake.current_location, next_apparatus: batch.used_by_apparatus || batch.processed_by_apparatus,
        worker_display_name: intake.actor_display_name, started_at_unix: batch.created_at_unix, description: intake.note,
        payload_json: { input_wip_source_kind: 'opening_wip' },
      }));
  });
}

export function WorkerWipHistory({ session, order, onClose, stageHistory = false, apparatusNames = {} }: Props) {
  const colors = useWorkerColors();
  const android = Platform.OS === 'android';
  const sheetBackground = Platform.OS === 'ios' ? PlatformColor('systemGroupedBackground') : colors.field;
  const sheetCard = Platform.OS === 'ios' ? PlatformColor('secondarySystemGroupedBackground') : colors.surface;
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const [batches, setBatches] = useState<WipBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const detailsSheet = useNativeSheet();
  const [permission, requestPermission] = useCameraPermissions();
  const [searching, setSearching] = useState(false);
  const [manualQr, setManualQr] = useState('');
  const [foundId, setFoundId] = useState('');
  const [notFound, setNotFound] = useState(false);
  const searchHandled = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const opening = stageHistory ? loadOpeningWip(session, order, controller.signal) : Promise.resolve([]);
    void Promise.all([loadWorkerWipBatches(session, order.id, order.apparatusId, controller.signal), opening]).then(([result, openingBatches]) => {
      if (controller.signal.aborted) return;
      const merged = new Map(openingBatches.map(batch => [batch.batch_id, batch]));
      for (const batch of result) merged.set(batch.batch_id, batch);
      setBatches([...merged.values()].sort((a, b) => Math.max(b.completed_at_unix || 0, b.started_at_unix || 0) - Math.max(a.completed_at_unix || 0, a.started_at_unix || 0) || String(b.batch_id).localeCompare(String(a.batch_id))));
      setLoading(false);
    }, reason => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Yuklab bo‘lmadi.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload, stageHistory, session, order]);

  const totals = batches.reduce((total, batch) => {
    const { gross, net } = wipBatchWeights(batch);
    const meters = wipMeters(batch);
    if (gross !== null) { total.gross += gross; total.grossCount++; }
    if (net !== null) { total.net += net; total.netCount++; }
    if (meters !== null) { total.meters += meters; total.meterCount++; }
    total[wipBatchKind(batch)]++;
    return total;
  }, { gross: 0, net: 0, meters: 0, grossCount: 0, netCount: 0, meterCount: 0, waiting: 0, inUse: 0, processed: 0 });
  const metric = (amount: number, count: number, unit: string) => count ? `${Number(amount.toFixed(6))} ${unit}${count < batches.length ? ' (qisman)' : ''}` : '—';
  const filtered = foundId ? batches.filter(batch => batch.batch_id === foundId) : batches;
  function searchQr(raw: string) {
    const qr = raw.trim().toUpperCase();
    if (!qr || searchHandled.current) return;
    searchHandled.current = true;
    const match = batches.find(batch => wipText(batch.qr_payload).toUpperCase() === qr);
    setFoundId(match?.batch_id ?? '');
    setNotFound(!match);
    setSearching(false);
  }
  function openBatch(batch: WipBatch) {
    if (!wipText(batch.qr_payload)) {
      setAlert({ title: 'WIP QR kodi mavjud emas', message: 'Bu WIP uchun QR kodi saqlanmagan.' });
      return;
    }
    detailsSheet.open(<WorkerWipBatchDetails session={session} order={order} batch={batch}
      apparatusNames={apparatusNames} onClose={detailsSheet.close} />, { dismissible: true });
  }
  const heading = <View style={[styles.header, android && styles.androidHeader]}>
    <View style={styles.flex}>
      <Text style={[styles.heading, { color: colors.text }]}>WIP tafsilotlari</Text>
      <Text style={{ color: colors.muted }}>{[order.code, order.title, apparatusNames[order.apparatusId]].filter(Boolean).join(' • ')}</Text>
    </View>
    <WorkerIconButton icon="close" label="Yopish" onPress={close} tonal />
  </View>;
  const status = <>
    {loading ? <ActivityIndicator color={colors.icon} /> : null}
    {!!error && <><Text style={styles.error}>{error}</Text><Host matchContents={{ vertical: true }}><Button label="Qayta urinish" onPress={() => { setLoading(true); setError(''); setFoundId(''); setNotFound(false); setReload(old => old + 1); }} /></Host></>}
    {!loading && !error && (batches.length ? <View style={[styles.card, { backgroundColor: sheetCard }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{batches.length} ta WIP yaratilgan</Text>
      <Text style={{ color: colors.muted }}>Bu order bo‘yicha hosil bo‘lgan yarim tayyor mahsulotlar:</Text>
      {!stageHistory && <>
        <Text style={{ color: colors.text }}>Jami brutto: {metric(totals.gross, totals.grossCount, 'kg')}</Text>
        <Text style={{ color: colors.text }}>Jami netto: {metric(totals.net, totals.netCount, 'kg')}</Text>
        <Text style={{ color: colors.text }}>Jami metraj: {metric(totals.meters, totals.meterCount, 'm')}</Text>
      </>}
      <View style={styles.chips}>
        {[['Kutilmoqda', totals.waiting], ['Ish jarayonida', totals.inUse], ['Ishlatilgan', totals.processed]].map(([label, count]) =>
          <Text key={label} style={[styles.chip, { backgroundColor: colors.field, color: colors.text }]}>{label}: {count}</Text>)}
      </View>
    </View> : <Text style={{ color: colors.muted }}>Bu buyurtma bo‘yicha WIP topilmadi.</Text>)}
  </>;
  return <View style={[styles.flex, { backgroundColor: sheetBackground }]}>
    {android && heading}
    {android && batches.length === 0 ? <View style={[styles.content, styles.flex]}>{status}</View> : <FlatList
      nestedScrollEnabled
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={batch => String(batch.batch_id)}
      ListHeaderComponent={android ? status : <>{heading}{status}</>}
      renderItem={({ item, index }) => {
        const position = foundId ? batches.indexOf(item) + 1 : index + 1;
        const title = wipText(item.label_item_name) || wipText(item.label_item_code) || `WIP ${position}`;
        const rows = wipBatchRows(item, apparatusNames);
        return <Pressable accessibilityRole="button" android_ripple={{}} onPress={() => openBatch(item)} onLongPress={() => openBatch(item)}
          style={[styles.card, { backgroundColor: colors.field }]}>
          <View style={styles.rowHeader}>
            <Text style={[styles.chip, { color: colors.text, backgroundColor: sheetCard }]}>{position}</Text>
            <Text style={[styles.heading, styles.flex, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.chip, { color: colors.text, backgroundColor: sheetCard }]}>{wipBatchStatus(item)}</Text>
          </View>
          {rows.map(([label, text]) => <Text key={label} style={{ color: colors.muted }}>{label}: {text}</Text>)}
          {!!wipText(item.qr_payload) && <Text numberOfLines={2} style={{ color: colors.muted }}>QR: {item.qr_payload}</Text>}
          {!!wipText(item.description) && <Text style={{ color: colors.muted }}>Izoh: {item.description}</Text>}
        </Pressable>;
      }} />}
    <View style={styles.footer}>
      {notFound && <Text style={styles.error}>Bu ro‘yxatda ushbu QR bilan WIP topilmadi</Text>}
      <Host matchContents={{ vertical: true }}>
        <Column spacing={6}>
          {!!foundId && <Button label="Barchasini ko‘rsatish" variant="text" onPress={() => { setFoundId(''); setNotFound(false); }} />}
          <Button label="QR orqali WIP qidirish" disabled={searching || loading || !!error || !batches.length} onPress={() => {
            searchHandled.current = false;
            setManualQr('');
            setNotFound(false);
            setSearching(true);
            if (permission?.status === 'undetermined') void requestPermission();
          }} />
        </Column>
      </Host>
    </View>
    <WorkerFormDialog visible={searching} title="QR orqali WIP qidirish" onCancel={() => setSearching(false)}
      confirmLabel="Qidirish" confirmDisabled={!manualQr.trim()} onConfirm={() => searchQr(manualQr)}>
      {searching && permission?.granted && <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => searchQr(data)} />}
      {searching && !permission?.granted && <Host matchContents={{ vertical: true }}><Button label="Kameraga ruxsat berish" onPress={() => { void requestPermission(); }} /></Host>}
      {searching && <WorkerFormField label="WIP QR kodini kiriting" onChangeText={setManualQr} />}
    </WorkerFormDialog>
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 10, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  androidHeader: { paddingTop: 12, paddingHorizontal: 12, marginBottom: 0 },
  flex: { flex: 1 },
  heading: { fontSize: 17, fontWeight: '700' },
  card: { padding: 16, borderRadius: 16, gap: 5, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, fontSize: 12 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  footer: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  camera: { height: 200, borderRadius: 12, overflow: 'hidden' },
  error: { color: '#a52626', marginVertical: 8 },
});
