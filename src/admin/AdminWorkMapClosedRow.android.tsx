import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { AdminClosedRank } from './AdminClosedHistoryAccessories';
import type { AdminWorkMapClosedRow as ClosedRow } from './adminWorkMapClosedModel';

export function AdminWorkMapClosedRow({ row, first, last }: {
  row: Pick<ClosedRow, 'position' | 'headline' | 'supporting'>; first?: boolean; last?: boolean;
}) {
  const { colors } = useBaseTheme();
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surfaceContainerLowest}>
    <AdminClosedRank position={row.position} />
    <View style={styles.text}>
      <Text style={[styles.title, { color: colors.onSurface }]}>{row.headline}</Text>
      {!!row.supporting && <Text style={{ color: colors.onSurfaceVariant }}>{row.supporting}</Text>}
    </View>
  </WorkerQueueCard>;
}
const styles = StyleSheet.create({ text: { flex: 1, marginStart: 14, gap: 4 }, title: { fontSize: 16, fontWeight: '700' } });
