import { Button, Column, Host, ListItem } from '@expo/ui';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { WorkerDetailRecovery } from '../workerDetailRecovery';
import { readWorkerDetailSnapshot } from '../workerDetailRecoveryRead';
import { workerOrderPresentationDenied } from '../workerOrderPresentation';
import { WorkerOrderSyncProgress } from './WorkerOrderSyncProgress';
import { workerOrderDetailFromSnapshot, type CompletedOrder, type QueueOrder, type WorkerOrderDetail } from '../workerApi';
import type { QueueCursor } from '../workerOrderLogic';
import { useWorkerColors } from './useWorkerColors';
import { WorkerOrderHeader, WorkerOrderImage } from './WorkerOrderHeader';
import { WorkerIconButton } from './WorkerIconButton';
import { WorkerOrderOverview } from './WorkerOrderOverview';
import { WorkerSheetCloseContext } from './workerSheetContext';

type Props = { session: Session; apparatusId: string; order: QueueOrder; queueCursor: QueueCursor | null; queueWindow?: string; onClose: () => void };
type DetailResult = { key: string; detail: WorkerOrderDetail | null; error: string; loading: boolean; denied: boolean };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function WorkerOrderDetails({ session, apparatusId, order, queueCursor, queueWindow = '', onClose }: Props) {
  const colors = useWorkerColors();
  const close = useContext(WorkerSheetCloseContext) ?? onClose;
  const [result, setResult] = useState<DetailResult | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const epoch = queueCursor?.epoch, rev = queueCursor?.rev;
  const identity = JSON.stringify([sessionReadScope(session), apparatusId, order.id]);
  const current = result?.key === identity ? result : null;
  const hydrated = useRef(false), mounted = useRef(true), previousIdentity = useRef(identity);
  const latest = useRef({ identity, session, apparatusId, orderId: order.id, queueCursor });
  useLayoutEffect(() => { latest.current = { identity, session, apparatusId, orderId: order.id, queueCursor }; },
    [identity, session, apparatusId, order.id, queueCursor]);
  const owner = useRef<WorkerDetailRecovery | null>(null);
  useEffect(() => {
    const recovery = new WorkerDetailRecovery({
    current: () => mounted.current && !!activeSessionToken(latest.current.session),
    hydrated: () => hydrated.current,
    invalidate: () => {
      const key = latest.current.identity;
      setResult(previous => ({ key, detail: previous?.key === key ? previous.detail : null, error: '', loading: true, denied: false }));
    },
    load: async valid => {
      const input = latest.current;
      const isCurrent = () => valid() && input.identity === latest.current.identity &&
        sessionReadScope(input.session) === sessionReadScope(latest.current.session);
      const snapshot = await readWorkerDetailSnapshot(input.session, input.apparatusId, input.orderId,
        () => latest.current.queueCursor, isCurrent);
      if (!isCurrent()) return;
      hydrated.current = true;
      setResult({ key: input.identity, detail: workerOrderDetailFromSnapshot(snapshot, input.orderId), error: '', loading: false, denied: false });
    },
    failed: (error, initial) => {
      const key = latest.current.identity;
      setResult(previous => ({ key, detail: previous?.key === key ? previous.detail : null, loading: false,
        denied: workerOrderPresentationDenied(error), error: initial ? error instanceof Error ? error.message : 'Buyurtmani yuklab bo‘lmadi.' : '' }));
    }, denied: workerOrderPresentationDenied,
    });
    owner.current = recovery;
    return () => recovery.dispose();
  }, []);
  useEffect(() => {
    if (previousIdentity.current !== identity) { previousIdentity.current = identity; hydrated.current = false; owner.current!.reset(); }
    owner.current!.invalidate();
  }, [identity, epoch, rev, queueWindow]);
  useEffect(() => {
    const recovery = owner.current!;
    mounted.current = true; recovery.activate();
    recovery.setForeground(AppState.currentState == null || AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => recovery.setForeground(state === 'active'));
    return () => { mounted.current = false; subscription.remove(); recovery.dispose(); };
  }, []);

  const detail = current?.detail;
  const map = detail?.map ?? {};
  const code = text(map.order_number) || text(map.code) || order.code || order.id;
  const imageId = text(map.image_id) || order.imageId;
  if (imageOpen) return <WorkerOrderImage session={session} orderId={order.id} imageId={imageId} onClose={() => setImageOpen(false)} />;
  return <View style={[styles.screen, { backgroundColor: colors.field }]}>
    <ScrollView nestedScrollEnabled contentContainerStyle={styles.content}>
      <WorkerOrderHeader session={session} orderId={order.id} imageId={imageId} code={code}
        onOpenImage={() => setImageOpen(true)} onClose={close} />
      {<WorkerOrderSyncProgress pending={!current || current.loading && !current.denied} color={colors.icon} />}
      {!!current?.error && <View style={styles.card}>
        <Text style={styles.error}>{current.error}</Text>
        <Host matchContents={{ vertical: true }}><Button variant="text" label="Qayta urinish" onPress={() => owner.current?.retry()} /></Host>
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
