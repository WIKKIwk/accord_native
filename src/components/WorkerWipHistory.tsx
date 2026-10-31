import { Button, Host } from '@expo/ui';
import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, PlatformColor, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { CompletedOrder } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerSheetCloseContext } from './workerSheetContext';
import { WorkerAlert } from './WorkerAlert';
import type { WorkerAlertData } from './workerDialogTypes';
import { WorkerIconButton } from './WorkerIconButton';

type Batch = Record<string, any>;
type Props = { session: Session; order: CompletedOrder; onClose: () => void };
const value = (item: unknown) => typeof item === 'string' ? item.trim() : '';
const date = (item: unknown) => typeof item === 'number' && item > 0 ? new Date(item * 1000).toLocaleString() : '';

function kind(batch: Batch) {
  const flow = value(batch.status_detail?.flow_status);
  if (flow === 'in_progress' || batch.wip_status === 'in_use') return 'Ish jarayonida';
  if (['consumed_by_next_stage', 'accepted_to_stock'].includes(flow) || batch.wip_status === 'processed') return 'Ishlatilgan';
  return 'Kutilmoqda';
}

export function WorkerWipHistory({ session, order, onClose }: Props) {
  const colors = useWorkerColors();
  const sheetBackground = Platform.OS === 'ios' ? PlatformColor('systemGroupedBackground') : colors.field;
  const sheetCard = Platform.OS === 'ios' ? PlatformColor('secondarySystemGroupedBackground') : colors.surface;
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [alert, setAlert] = useState<WorkerAlertData | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    const all = new Map<string, Batch>();
    const seen = new Set<string>();
    let cursor = '';
    do {
      const query = new URLSearchParams({ status: 'all', order_id: order.id, producer_apparatus: order.apparatusId, limit: '500' });
      if (cursor) query.set('before_batch_id', cursor);
      const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/wip-batches?${query}`, { signal });
      if (!response.ok) throw new Error(`Rulonlarni yuklab bo‘lmadi (${response.status}).`);
      const payload = await response.json();
      if (!Array.isArray(payload.batches)) throw new Error('Server javobi noto‘g‘ri.');
      for (const batch of payload.batches) {
        if (value(batch?.order_id) === order.id && value(batch?.apparatus) === order.apparatusId && value(batch?.batch_id)) all.set(batch.batch_id, batch);
      }
      cursor = value(payload.next_before_batch_id);
      if (cursor && seen.has(cursor)) throw new Error('Rulonlar ro‘yxatini yuklab bo‘lmadi.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    return [...all.values()].sort((a, b) => Math.max(b.completed_at_unix || 0, b.started_at_unix || 0) - Math.max(a.completed_at_unix || 0, a.started_at_unix || 0) || String(b.batch_id).localeCompare(String(a.batch_id)));
  }, [session, order.id, order.apparatusId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(result => { if (!controller.signal.aborted) { setBatches(result); setLoading(false); } }, reason => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : 'Yuklab bo‘lmadi.'); setLoading(false); } });
    return () => controller.abort();
  }, [load, reload]);

  const totals = batches.reduce((total, batch) => {
    const gross = Number(batch.payload_json?.gross_qty ?? batch.finished_goods_kg);
    const bobina = Number(batch.bobina_kg);
    const meters = Number(batch.finished_goods_meter ?? (['m', 'meter', 'metr'].includes(value(batch.uom).toLowerCase()) ? batch.produced_qty : NaN));
    if (Number.isFinite(gross) && gross > 0) { total.gross += gross; total.grossCount++; if (batch.bobina_kg != null && Number.isFinite(bobina) && bobina >= 0 && bobina <= gross) { total.net += gross - bobina; total.netCount++; } }
    if (Number.isFinite(meters) && meters >= 0) { total.meters += meters; total.meterCount++; }
    return total;
  }, { gross: 0, net: 0, meters: 0, grossCount: 0, netCount: 0, meterCount: 0 });
  const metric = (amount: number, count: number, unit: string) => count ? `${Number(amount.toFixed(6))} ${unit}${count < batches.length ? ' (qisman)' : ''}` : '—';
  const header = <>
    <View style={styles.header}><View style={styles.flex}><Text style={[styles.heading, { color: colors.text }]}>Rulonlar tarixi</Text><Text style={{ color: colors.muted }}>{[order.code, order.title].filter(Boolean).join(' · ')}</Text></View><WorkerIconButton icon="close" label="Yopish" onPress={close} tonal /></View>
    {loading ? <ActivityIndicator color={colors.icon} /> : null}
    {!!error && <><Text style={styles.error}>{error}</Text><Host matchContents={{ vertical: true }}><Button label="Qayta urinish" onPress={() => { setLoading(true); setError(''); setReload(old => old + 1); }} /></Host></>}
    {!loading && !error && <View style={[styles.card, { backgroundColor: sheetCard }]}><Text style={[styles.heading, { color: colors.text }]}>Jami: {batches.length} ta rulon</Text><Text style={{ color: colors.muted }}>Brutto: {metric(totals.gross, totals.grossCount, 'kg')} · Netto: {metric(totals.net, totals.netCount, 'kg')}</Text><Text style={{ color: colors.muted }}>Metr: {metric(totals.meters, totals.meterCount, 'm')}</Text>{!batches.length && <Text style={{ color: colors.muted }}>Rulonlar topilmadi.</Text>}</View>}
  </>;
  return <View style={styles.flex}><FlatList nestedScrollEnabled style={{ backgroundColor: sheetBackground }} contentContainerStyle={styles.content} data={batches} keyExtractor={batch => String(batch.batch_id)} ListHeaderComponent={header} renderItem={({ item, index }) => {
    const title = value(item.label_item_name) || value(item.label_item_code) || `Rulon ${index + 1}`;
    const rows = [
      ['Miqdor', `${item.produced_qty ?? '—'} ${value(item.uom)}`.trim()], ['Boshlangan', date(item.started_at_unix)], ['Yakunlangan', date(item.completed_at_unix)],
      ['Aparat', value(item.apparatus)], ['Joylashuv', value(item.current_location) || value(item.current_apparatus)],
      ['Keyingi aparat', value(item.next_apparatus)], ['Ishchi', value(item.worker_display_name) || value(item.executor_name) || value(item.worker_ref)],
    ].filter(row => row[1]);
    return <Pressable onPress={() => setAlert({ title, message: [...rows.map(row => `${row[0]}: ${row[1]}`), value(item.qr_payload) ? `QR: ${value(item.qr_payload)}` : ''].filter(Boolean).join('\n') })} style={[styles.card, { backgroundColor: sheetCard }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{index + 1}. {title} · {kind(item)}</Text>
      {rows.map(([label, text]) => <Text key={label} style={{ color: colors.muted }}>{label}: {text}</Text>)}
    </Pressable>;
  }} /><WorkerAlert alert={alert} onDismiss={() => setAlert(null)} /></View>;
}

const styles = StyleSheet.create({ content: { padding: 12, gap: 10, paddingBottom: 28 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, flex: { flex: 1 }, heading: { fontSize: 17, fontWeight: '700' }, card: { padding: 16, borderRadius: 16, gap: 5, marginBottom: 10 }, error: { color: '#a52626', marginVertical: 8 } });
