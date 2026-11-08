import { ListItem } from '@expo/ui';
import { Button, Text } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminWorkMapClosedRow as ReadOnlyRow } from './AdminWorkMapClosedRow';
import type { AdminWorkMapMovePane, AdminWorkMapMoveProps } from './adminWorkMapMoveTypes';
function MovePane({ pane }: { pane: AdminWorkMapMovePane }) {
  const offset = useSharedValue(0), height = useSharedValue(0);
  return <View style={{ flex: 1 }}>
    <BaseHost matchContents={{ vertical: true }}><Text modifiers={[font({ textStyle: 'headline' })]}>{pane.name}</Text></BaseHost>
    <BaseHost style={{ flex: 1 }}><OrdersList active headerOffset={offset} headerHeight={height} topInset={0} onRefresh={pane.onRefresh}>
      {!!pane.error && <ListItem supportingText={pane.error} onPress={() => { void pane.onRefresh(); }}>{pane.retryLabel}</ListItem>}
      {pane.loaded && !pane.loading && !pane.rows.length && <Text>{pane.empty}</Text>}
      {pane.rows.map(row => <ReadOnlyRow key={row.id} row={row} />)}
      {pane.hasMore && !pane.error && <Button label={pane.moreLabel} onPress={() => { void pane.onMore(); }} />}
    </OrdersList></BaseHost>
  </View>;
}
/** Static read-only default panes; picker/selection/drag and transfer authority are intentionally absent. */
export function AdminWorkMapMove(props: AdminWorkMapMoveProps) {
  return <View style={{ flex: 1 }}>
    <BaseHost matchContents={{ vertical: true }}><Text>{props.partial}</Text>
      {!!props.error && <ListItem supportingText={props.error} onPress={() => { void props.onRetry(); }}>{props.retryLabel}</ListItem>}
      {!!props.empty && <Text>{props.empty}</Text>}
    </BaseHost>
    {props.loading && !props.panes.length && <ActivityIndicator />}
    {props.panes.map(pane => <MovePane key={pane.id} pane={pane} />)}
  </View>;
}
