import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { OrdersList } from '../shared/orders/OrdersList';
import { MetalayzerFrame } from './MetalayzerFrame.android';
import { formatMetalayzerQuantity, type MetalayzerMaterial } from './metalayzerApi';
import { useMetalayzerList } from './useMetalayzerList';

const passthrough = () => true;

export function MetalayzerList() {
  const state = useMetalayzerList(), colors = useMaterialColors();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const row = (item: MetalayzerMaterial, index: number) => <WorkerQueueCard first={index === 0} last={index === state.items.length - 1}
    backgroundColor={colors.surfaceContainerLowest ?? colors.surface}>
    <SymbolView name={{ android: 'check_circle' }} size={22} tintColor={colors.primary} />
    <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 3 }}>
      <Text numberOfLines={2} style={{ color: colors.onSurface, fontWeight: '700' }}>{item.itemName || item.itemCode}</Text>
      <Text numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{item.warehouse}</Text>
      <Text selectable style={{ color: colors.onSurfaceVariant }}>QR: {item.barcode}</Text>
    </View><Text style={{ color: colors.onSurfaceVariant }}>{formatMetalayzerQuantity(item.qty, item.uom)}</Text>
  </WorkerQueueCard>;
  return <MetalayzerFrame title="Metallangan xomashyolar" back busy={state.loading && state.items.length > 0}>
    <OrdersList rows={state.items} renderRow={row} rowKey={item => item.barcode} active onRefresh={state.reload}
      headerOffset={headerOffset} headerHeight={headerHeight} topInset={8} passthrough={passthrough}
      footer={state.cursor ? <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {state.moreError && <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>{state.moreError}</Text>}
        <WorkerSheetButton label={state.moreLoading ? 'Yuklanmoqda...' : state.moreError ? 'Qayta urinish' : 'Yana yuklash'}
          variant="outlined" disabled={state.moreLoading || state.loading} onPress={() => { void state.loadMore(); }} />
      </View> : null}>
      {state.loading && !state.items.length ? <ActivityIndicator /> : null}
      {state.error ? <WorkerQueueCard first last backgroundColor={colors.surface} onPress={() => { void state.reload(); }}>
        <SymbolView name={{ android: 'error_outline' }} size={22} tintColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1, padding: 12 }}><Text style={{ color: colors.onSurface }}>Ro‘yxat yuklanmadi</Text>
          <Text style={{ color: colors.onSurfaceVariant }}>{state.error}</Text><Text style={{ color: colors.primary }}>Qayta urinish</Text></View>
      </WorkerQueueCard> : !state.loading && !state.items.length ? <WorkerQueueCard first last backgroundColor={colors.surface}>
        <SymbolView name={{ android: 'inventory_2' }} size={22} tintColor={colors.onSurfaceVariant} />
        <Text style={{ color: colors.onSurface, padding: 12 }}>Metallangan xomashyo hali yo‘q</Text>
      </WorkerQueueCard> : null}
    </OrdersList>
  </MetalayzerFrame>;
}
