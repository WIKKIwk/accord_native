import { Column, Host, ListItem, RNHostView, Text } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import type { WorkerOrderDetail } from '../workerApi';
import { useWorkerColors } from './useWorkerColors';
import { WorkerWipHistory } from './WorkerWipHistory';

const stageStates: Record<string, string> = {
  pending: 'Kutilmoqda', waiting: 'Kutilmoqda', in_progress: 'Ish jarayonida', paused: 'Pauzada',
  completed: 'Tugallangan', frozen: 'Muzlatilgan', print_preflight: 'Rang chiqarilyapti',
  print_preflight_passed: 'Rang chiqdi', waiting_next_stage: 'Keyingi bosqich kutilmoqda',
};
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

type Props = { session: Session; orderId: string; code: string; title: string; imageId: string; detail: WorkerOrderDetail | null };

export function WorkerOrderOverview({ session, orderId, code, title, imageId, detail }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = useWorkerColors();
  const history = useNativeSheet();
  const meters = positive(detail?.map.base_length);
  const kg = positive(detail?.map.order_kg);
  const shafts = positive(detail?.map.roll_count);
  const width = positive(detail?.map.width_mm);
  function openStage(apparatusId: string) {
    const apparatusNames = Object.fromEntries(detail?.stages.filter(stage => stage.apparatusId).map(stage => [stage.apparatusId, stage.title]) ?? []);
    history.open(<WorkerWipHistory session={session} order={{ id: orderId, code, title, imageId, apparatusId }}
      apparatusNames={apparatusNames} stageHistory onClose={history.close} />, { dismissible: true });
  }
  return <>
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column>
          <ListItem testID="worker-order-summary" supportingText="Buyurtma bo‘yicha taxminiy ma’lumotlar"
            onPress={detail ? () => setExpanded(value => !value) : undefined}
            trailing={<RNHostView matchContents><SymbolView size={22} tintColor={colors.icon}
              name={{ android: expanded ? 'expand_less' : 'expand_more', ios: expanded ? 'chevron.up' : 'chevron.down' }} />
            </RNHostView>}>
            Kutilayotgan natija
          </ListItem>
          {expanded && detail && <>
            {meters !== null && <ListItem supportingText={`${Math.ceil(meters / 500) * 500} m`}>Metraj</ListItem>}
            {kg !== null && <ListItem supportingText={`${kg} kg`}>Og‘irlik</ListItem>}
            {shafts !== null && <ListItem supportingText={`${shafts} ta ${width ?? '—'} mm eniga ega bo‘lgan val ishlatiladi`}>Val</ListItem>}
            <ListItem supportingText={detail.map.standard_print_side === false ? 'Nostandart' : 'Standart'}>Bosma tomoni</ListItem>
          </>}
        </Column>
      </Host>
    </View>
    {expanded && detail?.stages.length ? <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Host matchContents={{ vertical: true }} style={styles.host}>
        <Column>
          {detail.stages.map((stage, index) => <ListItem key={stage.id}
            leading={<Text>{String(index + 1)}</Text>} supportingText={stageStates[stage.state]}
            onPress={stage.apparatusId ? () => openStage(stage.apparatusId) : undefined}>
            {stage.title}
          </ListItem>)}
        </Column>
      </Host>
    </View> : null}
  </>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden' },
  host: { width: '100%' },
});
