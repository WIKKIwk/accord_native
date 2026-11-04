import { Button, Column, Host, ListItem } from '@expo/ui';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Session } from '../auth';
import { readWorkerOrderDetail, type CompletedOrder, type QueueOrder, type WorkerOrderDetail } from '../workerApi';
import type { QueueCursor } from '../workerOrderLogic';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderHeader, WorkerOrderImage } from './WorkerOrderHeader';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderOverview } from './WorkerOrderOverview';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { session: Session; apparatusId: string; order: QueueOrder; queueCursor: QueueCursor | null; onClose: () => void };
type DetailResult = { key: string; detail: WorkerOrderDetail | null; error: string };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function WorkerOrderDetails({ session, apparatusId, order, queueCursor, onClose }: Props) {
  const colors = useWorkerColors();
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const [result, setResult] = useState<DetailResult | null>(null);
  const [retry, setRetry] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const epoch = queueCursor?.epoch;
  const rev = queueCursor?.rev;
  const requestKey = JSON.stringify([session.imageCacheScope, apparatusId, order.id, epoch, rev, retry]);
  const current = result?.key === requestKey ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    void readWorkerOrderDetail(session, apparatusId, order.id, { epoch, rev }, controller.signal).then(detail => {
      if (!controller.signal.aborted) setResult({ key: requestKey, detail, error: '' });
    }, reason => {
      if (controller.signal.aborted) return;
      const error = reason instanceof Error ? reason.message : 'Buyurtmani yuklab bo‘lmadi.';
      setResult({ key: requestKey, detail: null, error });
    });
    return () => controller.abort();
  }, [session, apparatusId, order.id, epoch, rev, requestKey]);

  const detail = current?.detail;
  const map = detail?.map ?? {};
  const code = text(map.order_number) || text(map.code) || order.code || order.id;
  const imageId = text(map.image_id) || order.imageId;
  if (imageOpen) return <WorkerOrderImage session={session} orderId={order.id} imageId={imageId} onClose={() => setImageOpen(false)} />;
  return <View style={[styles.screen, { backgroundColor: colors.field }]}>
    <ScrollView nestedScrollEnabled contentContainerStyle={styles.content}>
      <WorkerOrderHeader session={session} orderId={order.id} imageId={imageId} code={code}
        onOpenImage={() => setImageOpen(true)} onClose={close} />
      {!current && <ActivityIndicator color={colors.icon} />}
      {!!current?.error && <View style={styles.card}>
        <Text style={styles.error}>{current.error}</Text>
        <Host matchContents={{ vertical: true }}><Button variant="text" label="Qayta urinish" onPress={() => setRetry(value => value + 1)} /></Host>
      </View>}
      <WorkerOrderOverview session={session} orderId={order.id} code={code} imageId={imageId}
        title={text(map.title) || order.title} detail={detail ?? null} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 4, gap: 8, paddingBottom: 24 },
  card: { padding: 12, gap: 8 }, error: { color: '#a52626' },
});

export function WorkerOrderFreezeDetails({ order, apparatusName, onClose }: { order: CompletedOrder; apparatusName: string; onClose: () => void }) {
  const colors = useWorkerColors();
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  return <View style={styles.card}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: colors.text }}>Muzlatish tafsilotlari</Text>
      <WorkerIconButton icon="close" label="Yopish" tonal onPress={close} />
    </View>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <Column spacing={6}>
        <ListItem supportingText={[order.code, order.title, apparatusName].filter(Boolean).join(' • ')}>Muzdan ochilgan</ListItem>
        <ListItem supportingText={order.issueNote}>Muammo izohi</ListItem>
      </Column>
    </Host>
  </View>;
}
