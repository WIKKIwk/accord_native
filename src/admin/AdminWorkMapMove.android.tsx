import { ListItem } from '@expo/ui';
import { RNHostView, Text } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminWorkMapClosedRow as ReadOnlyRow } from './AdminWorkMapClosedRow';
import type { AdminWorkMapMovePane, AdminWorkMapMoveProps } from './adminWorkMapMoveTypes';
function MovePane({ pane }: { pane: AdminWorkMapMovePane }) {
  const offset = useSharedValue(0), height = useSharedValue(0);
  return <View style={{ flex: 1 }}>
    <BaseHost matchContents={{ vertical: true }}><ListItem testID={`admin-move-${pane.id}-picker`} onPress={pane.onPick}
      trailing={<RNHostView matchContents><SymbolView name={{ android: 'expand_more' }} size={24} importantForAccessibility="no" /></RNHostView>}>
      <Text style={{ typography: 'titleMedium' }}>{pane.name}</Text></ListItem></BaseHost>
    <OrdersList active headerOffset={offset} headerHeight={height} topInset={0} onRefresh={pane.onRefresh}>
      {!!pane.error && <ListItem supportingText={pane.error} onPress={() => { void pane.onRefresh(); }}>{pane.retryLabel}</ListItem>}
      {pane.loaded && !pane.loading && !pane.rows.length && <Text>{pane.empty}</Text>}
      {pane.rows.map(row => <ReadOnlyRow key={row.id} row={row} />)}
      {pane.hasMore && !pane.error && <ListItem onPress={() => { void pane.onMore(); }}>{pane.moreLabel}</ListItem>}
    </OrdersList>
  </View>;
}
export function AdminWorkMapMove(props: AdminWorkMapMoveProps) {
  return <View style={{ flex: 1 }}>
    {(!!props.error || !!props.empty) && <BaseHost matchContents={{ vertical: true }}>
      {!!props.error && <ListItem supportingText={props.error} onPress={() => { void props.onRetry(); }}>{props.retryLabel}</ListItem>}
      {!!props.empty && <Text>{props.empty}</Text>}
    </BaseHost>}
    {props.loading && !props.panes.length && <ActivityIndicator />}
    {props.panes.map(pane => <MovePane key={pane.id} pane={pane} />)}
  </View>;
}
