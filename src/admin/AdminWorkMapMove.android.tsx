import { ListItem } from '@expo/ui';
import { IconButton, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { isValidElement } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost';
import { OrdersList } from '../shared/orders/OrdersList';
import { AdminWorkMapMoveEmpty } from './AdminWorkMapMoveEmpty';
import { AdminWorkMapMoveHeader } from './AdminWorkMapMoveHeader';
import { AdminWorkMapMoveRow } from './AdminWorkMapMoveRow';
import { AdminWorkMapMoveSplit } from './AdminWorkMapMoveSplit';
import type { AdminWorkMapMovePane, AdminWorkMapMoveProps } from './adminWorkMapMoveTypes';
function MovePane({ pane }: { pane: AdminWorkMapMovePane }) {
  const offset = useSharedValue(0), height = useSharedValue(0);
  return <View style={{ flex: 1 }}>
    {!pane.loaded ? <View style={{ flex: 1 }} /> : !pane.rows.length ? <AdminWorkMapMoveEmpty text={pane.empty} />
      : <OrdersList active headerOffset={offset} headerHeight={height} topInset={0} onRefresh={pane.onRefresh}
        passthrough={element => isValidElement(element) && element.type === AdminWorkMapMoveRow}>
        {pane.rows.map((row, index) => <AdminWorkMapMoveRow key={row.id} row={row} first={index === 0} last={index === pane.rows.length - 1} />)}
        {pane.hasMore && pane.error == null && <ListItem onPress={() => { void pane.onMore(); }}>{pane.moreLabel}</ListItem>}
      </OrdersList>}
    {pane.error != null && <BaseHost matchContents={{ vertical: true }}><ListItem trailing={<IconButton onClick={() => { void pane.onRefresh(); }}
      modifiers={[testID(`admin-move-${pane.id}-retry`), semantics({ contentDescription: pane.retryLabel })]}><RNHostView matchContents>
      <SymbolView name={{ android: 'refresh' }} size={24} importantForAccessibility="no" /></RNHostView></IconButton>}><Text>{pane.error}</Text></ListItem></BaseHost>}
  </View>;
}
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
