import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { localizedGetter } from '../shared/localization';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { useMaterialContext } from './MaterialContext';
import { materialSequencePresentation } from './materialSequenceModel';
import { useMaterialSequence } from './useMaterialSequence';
import { orderCardAppearance } from '../workerOrderAppearance';

/** @v2 AdminProductionMapOrdersScreen: read-only Material supplyViewerMode. */
export function MaterialSequence() {
  const { session } = useMaterialContext(), { controller, state, rows, locale, openDetail, assignOrder, t, emptyMessage, positionFor, toneFor } = useMaterialSequence();
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), drawer = useRoleDrawer();
  const dark = useColorScheme() === 'dark';
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <OrdersHeader search={state.search} searchPlaceholder={t('worker.queue.search.sequence')}
      onSearchChange={controller.searchChanged.bind(controller)} onMenu={drawer.open}
      onProfile={() => router.navigate('/android-material/profile' as Href)} />
    <OrdersList onRefresh={controller.refresh} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={() => true}>
      <DropdownFilter label={t('worker.queue.filter.apparatus')} selectedLabel={state.selectedApparatus?.name ?? t('worker.queue.filter.unselected')}
        options={state.apparatus.map(item => ({ value: item.id, label: item.name }))} enabled={state.apparatus.length > 0}
        backgroundColor={colors.surface} onChange={id => controller.selectApparatus(id)} last />
      {state.loading ? <ActivityIndicator /> : null}
      {state.error ? <WorkerQueueCard first last backgroundColor={colors.surface} onPress={() => { void controller.refresh(); }}>
        <Text style={{ color: colors.onSurfaceVariant, padding: 16 }}>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
      </WorkerQueueCard> : null}
      {!state.loading && !state.error && !rows.length ? <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center', padding: 24 }}>
        {emptyMessage}
      </Text> : null}
      {rows.map((order, index) => {
        const item = materialSequencePresentation(order, state.snapshot, locale);
        const appearance = orderCardAppearance(toneFor(order), typeof colors.surfaceContainerLowest === 'string' ? colors.surfaceContainerLowest : '#ffffff', dark);
        return <WorkerQueueCard key={order.map.id} first={index === 0} last={index === rows.length - 1}
          backgroundColor={appearance.color ?? colors.surfaceContainerLowest} backgroundImage={appearance.gradient} onPress={() => openDetail(order)} onLongPress={() => assignOrder(order)}
          style={{ paddingLeft: 80, paddingRight: 12, paddingVertical: 8, minHeight: 61 }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 68, overflow: 'hidden' }}>
            <WorkerOrderThumbnail session={session} orderId={order.map.id} imageId={order.map.image_id} active
              size={68} backgroundColor={colors.surfaceContainerHigh} iconColor={colors.onSurfaceVariant} />
          </View>
          <View style={{ width: 28, height: 28, marginRight: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerHigh }}>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>{positionFor(order)}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={1} style={{ color: appearance.text ?? colors.onSurface, fontSize: 14, fontWeight: '600' }}>{[item.code, item.title].filter(Boolean).join(' • ')}</Text>
            {!!item.subtitle && <Text numberOfLines={1} style={{ color: appearance.secondary ?? colors.onSurfaceVariant, fontSize: 12 }}>{item.subtitle}</Text>}
          </View>
        </WorkerQueueCard>;
      })}
    </OrdersList>
  </View>;
}
