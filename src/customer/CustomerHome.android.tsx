import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import type { DispatchRecord } from '../shared/notificationApi';
import { useCustomerText } from './CustomerContext';
import { CustomerEmptyStatusState, CustomerLoadingState, CustomerRetryState } from './CustomerStates';
import { CustomerStatusPanel } from './CustomerStatusPanel';
import { customerHomeRecord, customerLayoutDirection, customerStatusRecord } from './customerPresentation';
import type { CustomerStatusKind } from './customerStore';
import { useCustomerHome, useCustomerStatus } from './useCustomerScreens';

type HomeProps = { onOpenStatus: (kind: CustomerStatusKind) => void; onOpenDetail: (id: string) => void };
type StatusProps = { kind: CustomerStatusKind; onOpenDetail: (id: string) => void };

// @v2 CustomerHomeScreen
export function CustomerHomeScreen({ onOpenStatus, onOpenDetail }: HomeProps) {
  const state = useCustomerHome(), colors = useMaterialColors(), { locale, text } = useCustomerText();
  if (!state.loaded) return state.loading || state.error == null ? <CustomerLoadingState /> : <CustomerRetryState retry={state.refresh} />;
  const direction = customerLayoutDirection(locale) === 'rightToLeft' ? 'rtl' : 'ltr';
  return <FlatList data={state.records} keyExtractor={item => item.id}
    refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.refresh(); }} />}
    contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
    ListHeaderComponent={<View>
      <CustomerStatusPanel summary={state.summary} onOpenStatus={onOpenStatus} />
      <View testID="customer-shipments-heading" style={{ marginHorizontal: 8, marginTop: 18, paddingTop: 16, direction,
        backgroundColor: colors.surfaceContainerLow, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: '700', marginHorizontal: 16, marginBottom: 14 }}>{text('recentShipmentsTitle')}</Text>
      </View>
    </View>}
    ListEmptyComponent={<View style={{ marginHorizontal: 8, paddingBottom: 18, backgroundColor: colors.surfaceContainerLow, direction,
      borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
      <Text style={{ color: colors.onSurfaceVariant, fontSize: 14, marginHorizontal: 20, marginTop: 4 }}>{text('noShipments')}</Text>
    </View>}
    renderItem={({ item, index }: { item: DispatchRecord; index: number }) => {
      const row = customerHomeRecord(item), first = index === 0, last = index === state.records.length - 1;
      return <View testID="customer-shipment-card" style={{ marginHorizontal: 8, backgroundColor: colors.surfaceContainerLow, direction,
        borderBottomLeftRadius: last ? 28 : 0, borderBottomRightRadius: last ? 28 : 0, overflow: 'hidden' }}>
        <View testID="customer-shipment-fill" style={{ backgroundColor: colors.surfaceContainer, overflow: 'hidden',
          borderTopLeftRadius: first ? 24 : 0, borderTopRightRadius: first ? 24 : 0,
          borderBottomLeftRadius: last ? 24 : 0, borderBottomRightRadius: last ? 24 : 0 }}>
          <Pressable accessibilityRole="button" android_ripple={{}} onPress={() => onOpenDetail(item.id)}
            style={{ paddingHorizontal: 18, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.onSurface, fontSize: 16, fontWeight: '500' }}>{row.name}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>{row.code}</Text>
              </View><Text style={{ color: colors.onSurfaceVariant, fontSize: 14, fontWeight: '600' }}>{row.quantity}</Text>
            </View>
          </Pressable>
          {!last ? <View testID="customer-shipment-divider" style={{ height: 1, marginHorizontal: 16, backgroundColor: colors.outlineVariant, opacity: 0.55 }} /> : null}
        </View>
      </View>;
    }} />;
}

// @v2 CustomerStatusDetailScreen
export function CustomerStatusDetailScreen({ kind, onOpenDetail }: StatusProps) {
  const state = useCustomerStatus(kind), colors = useMaterialColors();
  if (!state.loaded) return state.loading || state.error == null ? <CustomerLoadingState /> : <CustomerRetryState retry={state.refresh} />;
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
