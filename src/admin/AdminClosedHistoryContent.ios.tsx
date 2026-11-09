import { ListItem, Text } from '@expo/ui';
import { Divider, Image, RNHostView, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, font } from '@expo/ui/swift-ui/modifiers';
import { ActivityIndicator } from 'react-native';
import { AdminClosedLogIcon, AdminClosedRank } from './AdminClosedHistoryAccessories';
import { adminClosedLogRow } from './adminClosedLogPresentation';
import { adminWorkMapClosedRows } from './adminWorkMapClosedModel';
import type { AdminClosedHistoryContentProps } from './adminClosedHistoryContentTypes';

/** Native content only. The route does not yet connect its history owner or log sheet. */
export function AdminClosedHistoryContent({ row, summary, state, catalog, onToggle, onRetry, onLog }: AdminClosedHistoryContentProps) {
  const order = state.detail ?? summary, display = state.detail ? adminWorkMapClosedRows([state.detail])[0] : row;
  return <VStack alignment="leading" spacing={4}>
    <ListItem testID="admin-closed-history-header" onPress={onToggle} leading={<AdminClosedRank position={row.position} />}
      trailing={<Image systemName={state.expanded ? 'chevron.up' : 'chevron.down'} modifiers={[accessibilityHidden(true)]} />} supportingText={display.supporting}>
      <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{display.headline}</Text>
    </ListItem>
    {state.expanded && (state.loading ? <RNHostView matchContents><ActivityIndicator /></RNHostView>
      : state.error ? <ListItem onPress={onRetry}><Text>{`${state.error} · Qayta yuklash`}</Text></ListItem>
      : !order.logs.length ? <Text>Log yo‘q</Text> : order.logs.map((log, index) => {
        const item = adminClosedLogRow(log, catalog);
        return <VStack key={`${log.event_id}:${index}`} alignment="leading" spacing={4}>
          {index > 0 && <Divider />}
          <ListItem testID={`admin-closed-log-${index}`} onPress={() => onLog(order, log)} leading={<AdminClosedLogIcon icon={item.icon} />}
            trailing={<Image systemName="chevron.right" modifiers={[accessibilityHidden(true)]} />} supportingText={item.subtitle}><Text>{item.title}</Text></ListItem>
        </VStack>;
      }))}
  </VStack>;
}
