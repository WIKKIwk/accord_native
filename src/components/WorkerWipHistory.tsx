import { Button, Column, Host, RNHostView, Row, Text as NativeText } from '@expo/ui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SymbolView } from 'expo-symbols';
import { useContext, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, FlatList, Platform, PlatformColor, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { useNativeSheet } from '../nativeSheet';
import type { Apparatus, CompletedOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerWipHistoryPalette } from './useWorkerWipHistoryPalette';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerFormField } from './WorkerFormField';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderSheet } from './WorkerOrderSheet';
import { loadWorkerWipBatches, wipBatchKind, wipText, type WipApparatusNames, type WipBatch, type WipOrder } from '../workerWip';
import { WorkerWipBatchDetails } from './WorkerWipBatchDetails';
import { WorkerOrderFreezeDetails } from './WorkerOrderDetails';
import { useWorkerOrderText } from './useWorkerOrderText';
import { workerWipHistoryRows, workerWipHistoryTotals, workerWipHistoryTotalText } from '../workerWipHistoryPresentation';
import { workerWipStatusLabel } from '../workerWipDetailsPresentation';
import { useWorkerWipReactivation } from './useWorkerWipReactivation';

type Props = { session: Session; order: WipOrder; onClose: () => void; stageHistory?: boolean; apparatusNames?: WipApparatusNames;
  operation?: string; allowReactivation?: boolean; onReactivationAttempted?: () => void; onWritePending?: (pending: boolean) => void };
export type WorkerWipHistorySheetHandle = { open: (order: CompletedOrder, apparatusNames?: WipApparatusNames, apparatus?: Apparatus,
  onReactivationAttempted?: () => void, onWritePending?: (pending: boolean) => void) => void };

export function WorkerWipHistorySheet({ ref, session, onDismiss, presentationId }: {
  ref: Ref<WorkerWipHistorySheetHandle>;
  session: Session;
  onDismiss: () => void;
  presentationId?: number;
}) {
  const [selection, setSelection] = useState<{ order: CompletedOrder; apparatusNames?: WipApparatusNames; apparatus?: Apparatus;
    onReactivationAttempted?: () => void; onWritePending?: (pending: boolean) => void } | null>(null);
  useImperativeHandle(ref, () => ({ open: (order: CompletedOrder, apparatusNames?: WipApparatusNames, apparatus?: Apparatus,
    onReactivationAttempted?: () => void, onWritePending?: (pending: boolean) => void) => setSelection({ order, apparatusNames, apparatus, onReactivationAttempted, onWritePending }) }), []);
  if (!selection) return null;
  const { order, apparatusNames = {} } = selection;
  const close = () => {
    setSelection(current => current === selection ? null : current);
    onDismiss();
  };
  return <WorkerOrderSheet key={JSON.stringify([order.apparatusId, order.id, presentationId])} dismissible compact={!!order.issueNote} onClose={close}>
    {order.issueNote
      ? <WorkerOrderFreezeDetails order={order} apparatusName={apparatusNames[order.apparatusId] ?? ''} onClose={close} />
      : <WorkerWipHistory session={session} order={order} apparatusNames={apparatusNames} onClose={close}
        operation={selection.apparatus?.operation} allowReactivation={['laminate', 'glue', 'cut'].includes(selection.apparatus?.operation ?? '')}
        onReactivationAttempted={selection.onReactivationAttempted} onWritePending={selection.onWritePending} />}
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

export function WorkerWipHistory({ session, order, onClose, stageHistory = false, apparatusNames = {}, operation, allowReactivation, onReactivationAttempted, onWritePending }: Props) {
  const colors = useWorkerColors(), palette = useWorkerWipHistoryPalette(), { p, t } = useWorkerOrderText();
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
  const reactivation = useWorkerWipReactivation({ session, order, apparatusNames, operation, allowReactivation,
    showDetails: batch => openBatch(batch, true), onWritePending, onAttempted: () => {
      setLoading(true); setError(''); setFoundId(''); setNotFound(false); setReload(value => value + 1); onReactivationAttempted?.();
    } });
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
      setError(reason?.statusCode === 403 || reason?.code === 'forbidden' ? 'worker.wip.access_denied' : 'worker.wip.history.error');
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload, stageHistory, session, order]);

  const totals = batches.reduce((total, batch) => { total[wipBatchKind(batch)]++; return total; }, { waiting: 0, inUse: 0, processed: 0 });
  const outputTotals = workerWipHistoryTotals(batches);
  const outputLines = (['gross', 'net', 'meters'] as const).map(kind => {
    const total = outputTotals[kind];
    return <View key={kind}>
      <Text style={[{ color: android ? palette.summaryText : colors.text }, android && styles.androidTotal]}>{p(`worker.wip.history.total_${kind}`)}: {workerWipHistoryTotalText(total, kind === 'meters' ? 'm' : 'kg', p)}</Text>
      {total.known && total.missing ? <Text style={{ color: android ? palette.summaryText : colors.muted }}>{p('worker.wip.history.partial_total', { count: total.missing })}</Text> : null}
    </View>;
  });
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
  function openBatch(batch: WipBatch, afterActions = false) {
    if (detailsSheet.isOpen() || !afterActions && reactivation.isBusy()) return;
    if (!wipText(batch.qr_payload)) {
      setAlert({ title: p('worker.daily.wip_qr_missing'), message: p('worker.daily.wip_qr_missing.body'), confirmLabel: p('worker.action.close') });
      return;
    }
    detailsSheet.open(<WorkerWipBatchDetails session={session} order={order} batch={batch}
      apparatusNames={apparatusNames} onClose={detailsSheet.close} />, { dismissible: true });
  }
  const heading = <View style={[styles.header, android && styles.androidHeader]}>
    <View style={styles.flex}>
      <Text style={[styles.heading, { color: colors.text }, android && styles.androidTitle]}>{p('worker.wip.history.title')}</Text>
      <Text numberOfLines={android ? 2 : undefined} style={[{ color: colors.muted }, android && styles.androidSubtitle]}>{[order.code, order.title, apparatusNames[order.apparatusId]].filter(Boolean).join(' • ')}</Text>
    </View>
    <WorkerIconButton icon="close" label={p('worker.action.close')} onPress={close} tonal />
  </View>;
  const status = <>
    {loading ? <ActivityIndicator color={colors.icon} /> : null}
    {!!error && <><Text style={styles.error}>{p(error)}</Text><Host matchContents={{ vertical: true }}><Button label={p('worker.action.retry')} onPress={() => { setLoading(true); setError(''); setFoundId(''); setNotFound(false); setReload(old => old + 1); }} /></Host></>}
    {!loading && !error && (batches.length ? <View style={[styles.card, { backgroundColor: android ? palette.summary : sheetCard }]}>
      <Text style={[styles.heading, { color: android ? palette.summaryText : colors.text }]}>{p('worker.wip.history.summary', { count: batches.length })}</Text>
      <Text style={{ color: android ? palette.summaryText : colors.muted }}>{p('worker.wip.history.description')}</Text>
      {!stageHistory ? outputLines : null}
      <View style={styles.chips}>
        {[[p('worker.wip.status.waiting'), totals.waiting], [p('worker.wip.status.in_progress'), totals.inUse], [p('worker.wip.status.used'), totals.processed]].map(([label, count]) =>
          <Text key={label} style={[styles.chip, { backgroundColor: android ? palette.summaryChip : colors.field, color: android ? palette.summaryText : colors.text }, android && styles.androidCountChip]}>{label}: {count}</Text>)}
      </View>
    </View> : <Text style={{ color: colors.muted }}>{p('worker.wip.history.empty')}</Text>)}
  </>;
  return <View style={[styles.flex, { backgroundColor: sheetBackground }]}>
    {android && heading}
    {android && batches.length === 0 ? <View style={[styles.content, styles.flex]}>{status}</View> : <FlatList
      nestedScrollEnabled
      contentContainerStyle={[styles.content, android && styles.androidContent]}
      data={filtered}
      keyExtractor={batch => String(batch.batch_id)}
      ListHeaderComponent={android ? status : <>{heading}{status}</>}
      renderItem={({ item, index }) => {
        const position = foundId ? batches.indexOf(item) + 1 : index + 1;
        const title = wipText(item.label_item_name) || wipText(item.label_item_code) || `${p('worker.daily.wip')} ${position}`;
        const rows = workerWipHistoryRows(item, apparatusNames, p);
        return <Pressable accessibilityRole="button" android_ripple={{}} onPress={() => openBatch(item)} onLongPress={() => { if (!detailsSheet.isOpen()) void reactivation.open(item); }}
          style={[styles.card, { backgroundColor: android ? palette.card : colors.field }]}>
          <View style={[styles.rowHeader, android && styles.androidRowHeader]}>
            <Text style={[styles.chip, { color: android ? palette.numberText : colors.text, backgroundColor: android ? palette.number : sheetCard }, android && styles.androidNumber]}>{position}</Text>
            <Text numberOfLines={android ? 2 : undefined} style={[styles.heading, styles.flex, { color: android ? palette.cardText : colors.text }, android && styles.androidItemTitle]}>{title}</Text>
            <Text numberOfLines={android ? 1 : undefined} style={[styles.chip, android ? palette.status[wipBatchKind(item)] : { color: colors.text, backgroundColor: sheetCard }, android && styles.androidStatus]}>{workerWipStatusLabel(item, p)}</Text>
          </View>
          {rows.map(([label, text]) => android ? <View key={label} style={styles.androidInfoRow}>
            <Text style={[styles.androidInfoLabel, { color: palette.cardMuted }]}>{label}</Text>
            <Text style={[styles.androidInfoValue, { color: palette.cardText }]}>{text}</Text>
          </View> : <Text key={label} style={{ color: colors.muted }}>{label}: {text}</Text>)}
          {!!wipText(item.qr_payload) && <Text numberOfLines={2} style={[{ color: android ? palette.cardMuted : colors.muted }, android && styles.androidQr]}>{p('worker.wip.info.qr')} {item.qr_payload.trim()}</Text>}
          {!!wipText(item.description) && <Text style={{ color: android ? palette.cardMuted : colors.muted }}>{p('worker.wip.info.note')}: {item.description.trim()}</Text>}
        </Pressable>;
      }} />}
    <View style={[styles.footer, android && styles.androidFooter]}>
      {notFound && <Text style={styles.error}>{p('worker.wip.history.qr_not_found')}</Text>}
      <Host matchContents={{ vertical: true }} style={android ? styles.fullWidth : undefined}>
        <Column spacing={6} style={android ? { width: '100%' } : undefined}>
          {!!foundId && <Button label={p('worker.wip.history.show_all')} variant="text" onPress={() => { setFoundId(''); setNotFound(false); }} />}
          <Button label={p('worker.wip.history.search_qr')} style={android ? { width: '100%', height: 56 } : undefined} disabled={searching || loading || !!error || !batches.length} onPress={() => {
            searchHandled.current = false;
            setManualQr('');
            setNotFound(false);
            setSearching(true);
            if (permission?.status === 'undetermined') void requestPermission();
          }}>{android ? <Row spacing={8} alignment="center"><RNHostView matchContents><SymbolView name={{ android: 'qr_code_scanner', ios: 'qrcode.viewfinder' }} size={20}
            tintColor={searching || loading || !!error || !batches.length ? palette.cardMuted : palette.onPrimary} /></RNHostView><NativeText>{p('worker.wip.history.search_qr')}</NativeText></Row> : undefined}</Button>
        </Column>
      </Host>
    </View>
    <WorkerFormDialog visible={searching} title={p('worker.wip.history.search_qr')} onCancel={() => setSearching(false)}
      cancelLabel={p('worker.action.cancel')} confirmLabel={t('Qidirish')} confirmDisabled={!manualQr.trim()} onConfirm={() => searchQr(manualQr)}>
      {searching && permission?.granted && <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => searchQr(data)} />}
      {searching && !permission?.granted && <Host matchContents={{ vertical: true }}><Button label={t('Kameraga ruxsat berish')} onPress={() => { void requestPermission(); }} /></Host>}
      {searching && <WorkerFormField label={p('worker.wip.history.enter_qr')} onChangeText={setManualQr} />}
    </WorkerFormDialog>
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />{reactivation.dialogs}
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 10, paddingBottom: 28 },
  androidContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  androidHeader: { paddingTop: 12, paddingHorizontal: 16, marginBottom: 0 },
  flex: { flex: 1 },
  fullWidth: { width: '100%' },
  heading: { fontSize: 17, fontWeight: '700' },
  androidTitle: { fontSize: 20, lineHeight: 26 },
  androidSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  androidTotal: { fontWeight: '700' },
  card: { padding: 16, borderRadius: 16, gap: 5, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, fontSize: 12 },
  androidCountChip: { fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  androidRowHeader: { alignItems: 'flex-start', marginBottom: 10 },
  androidNumber: { width: 32, height: 32, paddingHorizontal: 0, paddingVertical: 0, lineHeight: 32, textAlign: 'center', fontSize: 14 },
  androidItemTitle: { minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  androidStatus: { maxWidth: '42%', flexShrink: 1, fontWeight: '700', paddingVertical: 5 },
  androidInfoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 3 },
  androidInfoLabel: { width: 108, fontSize: 13, lineHeight: 19 },
  androidInfoValue: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  androidQr: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  footer: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  androidFooter: { paddingHorizontal: 16 },
  camera: { height: 200, borderRadius: 12, overflow: 'hidden' },
  error: { color: '#a52626', marginVertical: 8 },
});
