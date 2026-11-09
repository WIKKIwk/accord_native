import { ListItem } from '@expo/ui';
import { Button, Text } from '@expo/ui/swift-ui';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminWorkMapClosedRow as ReadOnlyRow } from './AdminWorkMapClosedRow';
import { AdminWorkMapMoveHeader } from './AdminWorkMapMoveHeader';
import { AdminWorkMapMoveSplit } from './AdminWorkMapMoveSplit';
import type { AdminWorkMapMovePane, AdminWorkMapMoveProps } from './adminWorkMapMoveTypes';
function MovePane({ pane }: { pane: AdminWorkMapMovePane }) {
  const offset = useSharedValue(0), height = useSharedValue(0);
  return <View style={{ flex: 1 }}>
    <BaseHost style={{ flex: 1 }}><OrdersList active headerOffset={offset} headerHeight={height} topInset={0} onRefresh={pane.onRefresh}>
      {!!pane.error && <ListItem supportingText={pane.error} onPress={() => { void pane.onRefresh(); }}>{pane.retryLabel}</ListItem>}
      {pane.loaded && !pane.loading && !pane.rows.length && <Text>{pane.empty}</Text>}
      {pane.rows.map(row => <ReadOnlyRow key={row.id} row={row} />)}
      {pane.hasMore && !pane.error && <Button label={pane.moreLabel} onPress={() => { void pane.onMore(); }} />}
    </OrdersList></BaseHost>
  </View>;
}
/** Read-only panes; order selection, drag and transfer authority are intentionally absent. */
export function AdminWorkMapMove(props: AdminWorkMapMoveProps) {
  const top = props.panes.find(pane => pane.id === 'top'), bottom = props.panes.find(pane => pane.id === 'bottom');
  return <View style={{ flex: 1 }}>
    {(!!props.error || !!props.empty) && <BaseHost matchContents={{ vertical: true }}>
      {!!props.error && <ListItem supportingText={props.error} onPress={() => { void props.onRetry(); }}>{props.retryLabel}</ListItem>}
      {!!props.empty && <Text>{props.empty}</Text>}
    </BaseHost>}
    {props.loading && !props.panes.length && <ActivityIndicator />}
    {top && bottom && <AdminWorkMapMoveSplit topHeader={<AdminWorkMapMoveHeader pane={top} />} topBody={<MovePane pane={top} />}
      bottomHeader={<AdminWorkMapMoveHeader pane={bottom} />} bottomBody={<MovePane pane={bottom} />} />}
  </View>;
}
