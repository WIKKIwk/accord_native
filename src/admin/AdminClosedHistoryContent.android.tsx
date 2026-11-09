import { ListItem } from '@expo/ui';
import { Column, HorizontalDivider, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator } from 'react-native';
import { AdminClosedLogIcon, AdminClosedRank } from './AdminClosedHistoryAccessories';
import { adminClosedLogRow } from './adminClosedLogPresentation';
import { adminWorkMapClosedRows } from './adminWorkMapClosedModel';
import type { AdminClosedHistoryContentProps } from './adminClosedHistoryContentTypes';

/** Native content only. The route does not yet connect its history owner or log sheet. */
export function AdminClosedHistoryContent({ row, summary, state, catalog, onToggle, onRetry, onLog }: AdminClosedHistoryContentProps) {
  const order = state.detail ?? summary, display = state.detail ? adminWorkMapClosedRows([state.detail])[0] : row, colors = useMaterialColors();
  return <Column>
    <ListItem testID="admin-closed-history-header" onPress={onToggle} leading={<RNHostView matchContents><AdminClosedRank position={row.position} /></RNHostView>}
      trailing={<RNHostView matchContents><SymbolView name={{ android: state.expanded ? 'expand_less' : 'expand_more' }} size={22} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>} supportingText={display.supporting}>
      <Text style={{ typography: 'bodyLarge', fontWeight: '700' }}>{display.headline}</Text>
    </ListItem>
    {state.expanded && (state.loading ? <RNHostView matchContents><ActivityIndicator /></RNHostView>
      : state.error ? <ListItem onPress={onRetry}><Text>{`${state.error} · Qayta yuklash`}</Text></ListItem>
      : !order.logs.length ? <Text>Log yo‘q</Text> : order.logs.map((log, index) => {
        const item = adminClosedLogRow(log, catalog);
        return <Column key={`${log.event_id}:${index}`}>
          {index > 0 && <HorizontalDivider />}
          <ListItem testID={`admin-closed-log-${index}`} onPress={() => onLog(order, log)} leading={<RNHostView matchContents><AdminClosedLogIcon icon={item.icon} /></RNHostView>}
            trailing={<RNHostView matchContents><SymbolView name={{ android: 'chevron_right' }} size={18} tintColor={colors.onSurfaceVariant} importantForAccessibility="no" /></RNHostView>} supportingText={item.subtitle}><Text>{item.title}</Text></ListItem>
        </Column>;
      }))}
  </Column>;
}
