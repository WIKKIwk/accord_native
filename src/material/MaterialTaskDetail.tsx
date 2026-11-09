import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { sessionWitnessVersion, subscribeSessionWitness, type Session, type SessionWitness } from '../auth';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerOrderOverview } from '../components/WorkerOrderOverview';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { useWorkerColors } from '../components/useWorkerColors';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { SupplyTaskRow } from '../shared/supplyTasks/supplyTaskModels';
import { readMaterialTaskDetail } from './materialTaskDetailApi';

type Order = Awaited<ReturnType<typeof readMaterialTaskDetail>>;
type Props = { session: Session; witness: SessionWitness; row: SupplyTaskRow; isCurrent: () => boolean; onClose: () => void };
type Result = { attempt: number; order: Order | null; error: boolean };

/** Partial read-only source detail using the existing native order summary and sheet controls. */
export function MaterialTaskDetail({ session, witness, row, isCurrent, onClose }: Props) {
  useSyncExternalStore(subscribeSessionWitness, sessionWitnessVersion, sessionWitnessVersion);
  const colors = useWorkerColors(), [attempt, setAttempt] = useState(0), [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    let mounted = true;
    const current = () => mounted && isSynchronouslyTrue(isCurrent);
    void readMaterialTaskDetail(session, witness, row, current).then(order => {
      if (current()) setResult({ attempt, order, error: false });
    }, () => { if (current()) setResult({ attempt, order: null, error: true }); });
    return () => { mounted = false; };
  }, [session, witness, row, isCurrent, attempt]);
  if (!isSynchronouslyTrue(isCurrent)) return null;
  const shown = result?.attempt === attempt ? result : null, map = shown?.order?.map;
  const code = map?.order_number || map?.code || row.order_number || row.code || row.id;
  const title = map?.title || row.title, customer = map?.customer_name || row.customer_name;
  return <View style={{ flex: 1, backgroundColor: colors.field }}><ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{code}</Text>
      {!!title && <Text style={{ color: colors.text }}>{title}</Text>}{!!customer && <Text style={{ color: colors.text }}>{customer}</Text>}
    </View><WorkerIconButton icon="close" label="Yopish" tonal onPress={onClose} /></View>
    {!shown && <ActivityIndicator color={colors.icon} />}
    {!!shown?.error && <View style={{ gap: 8 }}><Text style={{ color: colors.text }}>Buyurtmani yuklab bo‘lmadi.</Text>
      <WorkerSheetButton label="Qayta urinish" variant="text" onPress={() => { if (isSynchronouslyTrue(isCurrent)) setAttempt(value => value + 1); }} /></View>}
    {!!shown?.order && <WorkerOrderOverview session={session} orderId={row.id} code={code} title={title} imageId=""
      detail={{ map: shown.order.map, customer, stages: [] }} />}
  </ScrollView></View>;
}
