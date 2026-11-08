import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { DispatchRecord } from '../shared/notificationApi';
import { useCustomerText } from './CustomerContext';
import { CustomerEmptyStatusState, CustomerLoadingState, CustomerRetryState } from './CustomerStates';
import { customerHomeRecord, customerStatusRecord, customerStatusRows } from './customerPresentation';
import type { CustomerStatusKind } from './customerStore';
import { useCustomerHome, useCustomerStatus } from './useCustomerScreens';

type HomeProps = { onOpenStatus: (kind: CustomerStatusKind) => void; onOpenDetail: (id: string) => void };
type StatusProps = { kind: CustomerStatusKind; onOpenDetail: (id: string) => void };

// @v2 CustomerHomeScreen
export function CustomerHomeScreen({ onOpenStatus, onOpenDetail }: HomeProps) {
  const state = useCustomerHome(), colors = useMaterialColors(), { text } = useCustomerText();
  if (!state.loaded) return state.loading || !state.error ? <CustomerLoadingState /> : <CustomerRetryState retry={state.refresh} />;
  const rows = customerStatusRows(state.summary);
  return <FlatList data={state.records} keyExtractor={item => item.id}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
    contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
    ListHeaderComponent={<View style={{ gap: 2 }}>
      {rows.map((row, index) => <WorkerQueueCard key={row.kind} backgroundColor={row.kind === 'pending' ? colors.surfaceContainer : colors.surfaceContainerLow}
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
        onPress={() => onOpenDetail(item.id)}><View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16,
          paddingHorizontal: 10, paddingVertical: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.onSurface, fontSize: 16, fontWeight: '500' }}>{row.name}</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.code}</Text>
          </View><Text style={{ color: colors.onSurfaceVariant, fontSize: 14, fontWeight: '600' }}>{row.quantity}</Text>
        </View></WorkerQueueCard>;
    }} />;
}

// @v2 CustomerStatusDetailScreen
export function CustomerStatusDetailScreen({ kind, onOpenDetail }: StatusProps) {
  const state = useCustomerStatus(kind), colors = useMaterialColors();
  if (!state.loaded) return state.loading || !state.error ? <CustomerLoadingState /> : <CustomerRetryState retry={state.refresh} />;
  if (!state.records.length) return <CustomerEmptyStatusState />;
  return <FlatList data={state.records} keyExtractor={item => item.id} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
    renderItem={({ item, index }: { item: DispatchRecord; index: number }) => {
      const row = customerStatusRecord(item);
      return <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first={index === 0} last={index === state.records.length - 1}
        onPress={() => onOpenDetail(item.id)}><View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: '700', flex: 1 }}>{row.name}</Text>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.created}</Text>
          </View><Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: '700', letterSpacing: -0.6, marginTop: 10 }}>{row.quantity}</Text>
          {row.note ? <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 8 }}>{row.note}</Text> : null}
        </View></WorkerQueueCard>;
    }} />;
}
