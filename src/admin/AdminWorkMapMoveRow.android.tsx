import { StyleSheet, Text, View } from 'react-native';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { AdminClosedRank } from './AdminClosedHistoryAccessories';
import type { AdminWorkMapMoveRow as Row } from './adminWorkMapMoveTypes';

/** Read-only source row: no order selection, drag handle, detail or transfer callback. */
export function AdminWorkMapMoveRow({ row, first, last }: { row: Row; first?: boolean; last?: boolean }) {
  const { colors } = useBaseTheme();
  return <WorkerQueueCard backgroundColor={colors.surfaceContainerLowest} first={first} last={last}>
    <AdminClosedRank position={row.position} />
    <View style={styles.text}><Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>
      {!!row.code && <Text style={[styles.code, { color: colors.onSurfaceVariant }]}>{`${row.code} • `}</Text>}{row.title}
    </Text>{!!row.supporting && <Text numberOfLines={1} style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{row.supporting}</Text>}</View>
  </WorkerQueueCard>;
}
const styles = StyleSheet.create({ text: { flex: 1, marginStart: 14 }, title: { fontSize: 16, fontWeight: '700' },
  code: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 }, supporting: { fontSize: 12, marginTop: 4 } });
