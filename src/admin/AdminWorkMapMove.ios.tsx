import { ListItem } from '@expo/ui';
import { Button, HStack, Spacer, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, labelStyle } from '@expo/ui/swift-ui/modifiers';
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
      : <BaseHost style={{ flex: 1 }}><OrdersList active headerOffset={offset} headerHeight={height} topInset={0} onRefresh={pane.onRefresh}>
        {pane.rows.map((row, index) => <AdminWorkMapMoveRow key={row.id} row={row} first={index === 0} last={index === pane.rows.length - 1} />)}
        {pane.hasMore && pane.error == null && <Button label={pane.moreLabel} onPress={() => { void pane.onMore(); }} />}
      </OrdersList></BaseHost>}
    {pane.error != null && <BaseHost matchContents={{ vertical: true }}><HStack spacing={8}><Text>{pane.error}</Text><Spacer />
      <Button label={pane.retryLabel} systemImage="arrow.clockwise" onPress={() => { void pane.onRefresh(); }}
        modifiers={[labelStyle('iconOnly'), accessibilityLabel(pane.retryLabel)]} /></HStack></BaseHost>}
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
