import { StyleSheet, Text, View } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useBaseTheme } from '../components/useBaseTheme';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { WorkerQueueConnectionProgress } from '../components/WorkerQueueConnectionProgress';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminWorkMapMoveEmpty } from './AdminWorkMapMoveEmpty';
import { AdminWorkMapMoveHeader } from './AdminWorkMapMoveHeader';
import { AdminWorkMapMoveRow } from './AdminWorkMapMoveRow';
import { AdminWorkMapMoveSplit } from './AdminWorkMapMoveSplit';
import type { AdminWorkMapMovePane, AdminWorkMapMoveProps } from './adminWorkMapMoveTypes';

type ListContext = { active?: boolean; pagerGesture?: PanGesture };
const passthrough = () => true;

function MovePane({ pane, active = true, pagerGesture }: { pane: AdminWorkMapMovePane } & ListContext) {
  const { colors } = useBaseTheme(), offset = useSharedValue(0), height = useSharedValue(0);
  return <View style={styles.fill}>
    {!pane.loaded ? <View style={styles.fill} /> : !pane.rows.length ? <AdminWorkMapMoveEmpty text={pane.empty} /> :
      <OrdersList active={active} pagerGesture={pagerGesture} headerOffset={offset} headerHeight={height} topInset={0} onRefresh={pane.onRefresh}
        rows={pane.rows} rowKey={row => row.id} passthrough={passthrough}
        userScrollPagination={pane.hasMore && pane.error == null && !pane.loading ? { distance: 400, loadMore: () => { void pane.onMore(); } } : undefined}
        renderRow={(row, index) => <AdminWorkMapMoveRow row={row} first={index === 0} last={index === pane.rows.length - 1} />}>{null}</OrdersList>}
    {pane.error != null && <View style={styles.retry} testID={`admin-move-${pane.id}-retry`}>
      <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{pane.error}</Text>
      <WorkerIconButton icon="refresh" label={pane.retryLabel} onPress={() => { void pane.onRefresh(); }} />
    </View>}
  </View>;
}

export function AdminWorkMapMove({ active = true, pagerGesture, ...props }: AdminWorkMapMoveProps & ListContext) {
  const { colors } = useBaseTheme();
  const top = props.panes.find(pane => pane.id === 'top'), bottom = props.panes.find(pane => pane.id === 'bottom');
  return <View style={styles.fill}>
    {props.error && <View style={styles.problem}>
      <Text style={{ color: colors.onSurfaceVariant }}>{props.error}</Text>
      <WorkerSheetButton variant="text" label={props.retryLabel} onPress={() => { void props.onRetry(); }} />
    </View>}
    {!!props.empty && <AdminWorkMapMoveEmpty text={props.empty} />}
    <WorkerQueueConnectionProgress active={props.loading || props.panes.some(pane => pane.loading)} />
    {top && bottom && <AdminWorkMapMoveSplit topHeader={<AdminWorkMapMoveHeader pane={top} />} topBody={<MovePane pane={top} active={active} pagerGesture={pagerGesture} />}
      bottomHeader={<AdminWorkMapMoveHeader pane={bottom} />} bottomBody={<MovePane pane={bottom} active={active} pagerGesture={pagerGesture} />} />}
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, retry: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  message: { flex: 1 }, problem: { paddingHorizontal: 16, paddingTop: 8 },
});
