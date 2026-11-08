import { Button, Host } from '@expo/ui';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { DispatchRecord } from '../shared/notificationApi';
import { useCustomerText } from './CustomerContext';
import { customerHomeRecord, customerStatusRecord, customerStatusRows } from './customerPresentation';
import type { CustomerStatusKind } from './customerStore';
import { useCustomerHome, useCustomerStatus } from './useCustomerScreens';

type HomeProps = { onOpenStatus: (kind: CustomerStatusKind) => void; onOpenDetail: (id: string) => void };
type StatusProps = { kind: CustomerStatusKind; onOpenDetail: (id: string) => void };

function LoadingOrRetry({ loading, retry }: { loading: boolean; retry: () => Promise<void> }) {
  const colors = useMaterialColors(), { text } = useCustomerText();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    {loading ? <ActivityIndicator /> : <><Text style={{ color: colors.onSurfaceVariant }}>{text('serverDisconnectedRetry')}</Text>
      <Host matchContents><Button label={text('retry')} onPress={() => { void retry(); }} /></Host></>}
  </View>;
}

// @v2 CustomerHomeScreen
export function CustomerHomeScreen({ onOpenStatus, onOpenDetail }: HomeProps) {
  const state = useCustomerHome(), colors = useMaterialColors(), { text } = useCustomerText();
  if (!state.loaded) return <LoadingOrRetry loading={state.loading || !state.error} retry={state.refresh} />;
  const rows = customerStatusRows(state.summary);
  return <FlatList data={state.records} keyExtractor={item => item.id}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
    contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
    ListHeaderComponent={<View style={{ gap: 2 }}>
      {rows.map((row, index) => <WorkerQueueCard key={row.kind} backgroundColor={colors.surfaceContainerLow}
        first={index === 0} last={index === rows.length - 1} onPress={() => onOpenStatus(row.kind)}>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 16 }}>{text(row.titleKey)}</Text>
        <Text style={{ color: colors.onSurface, fontSize: 16 }}>{row.count}</Text>
      </WorkerQueueCard>)}
      <Text style={{ color: colors.onSurface, fontSize: 20, marginHorizontal: 24, marginTop: 16, marginBottom: 12 }}>{text('recentShipmentsTitle')}</Text>
    </View>}
    ListEmptyComponent={<Text style={{ color: colors.onSurfaceVariant, marginHorizontal: 24 }}>{text('noShipments')}</Text>}
    renderItem={({ item, index }: { item: DispatchRecord; index: number }) => {
      const row = customerHomeRecord(item);
      return <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first={index === 0} last={index === state.records.length - 1}
        onPress={() => onOpenDetail(item.id)}><View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 16 }}>{row.name}</Text>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.code}</Text>
        </View><Text style={{ color: colors.onSurfaceVariant }}>{row.quantity}</Text></WorkerQueueCard>;
    }} />;
}

// @v2 CustomerStatusDetailScreen
export function CustomerStatusDetailScreen({ kind, onOpenDetail }: StatusProps) {
  const state = useCustomerStatus(kind), colors = useMaterialColors(), { text } = useCustomerText();
  if (!state.loaded) return <LoadingOrRetry loading={state.loading || !state.error} retry={state.refresh} />;
  if (!state.records.length) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: colors.onSurface }}>{text('noRecordsYet')}</Text></View>;
  return <FlatList data={state.records} keyExtractor={item => item.id} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
    renderItem={({ item, index }: { item: DispatchRecord; index: number }) => {
      const row = customerStatusRecord(item);
      return <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first={index === 0} last={index === state.records.length - 1}
        onPress={() => onOpenDetail(item.id)}><View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.onSurface, fontSize: 20, flex: 1 }}>{row.name}</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.created}</Text>
          </View><Text style={{ color: colors.onSurface, fontSize: 24 }}>{row.quantity}</Text>
          {row.note ? <Text style={{ color: colors.onSurfaceVariant }}>{row.note}</Text> : null}
        </View></WorkerQueueCard>;
    }} />;
}
