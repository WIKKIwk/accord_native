import { Button, HStack, Section, Text } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { router, type Href } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { localizedGetter } from '../shared/localization';
import { useRoleDrawer } from '../shared/navigation/roleDrawerContext';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { useMaterialContext } from './MaterialContext';
import { materialSequencePresentation } from './materialSequenceModel';
import { useMaterialSequence } from './useMaterialSequence';

/** @v2 AdminProductionMapOrdersScreen: read-only Material supplyViewerMode. */
export function MaterialSequence() {
  const { session } = useMaterialContext(), drawer = useRoleDrawer();
  const { controller, state, rows, locale, openDetail, assignOrder, t, emptyMessage, positionFor, toneFor } = useMaterialSequence();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <OrdersWorkspace session={session} tabs={state.apparatus} selected={state.selectedApparatus?.id ?? ''}
    title="Ketma-ketlik" searchPlaceholder={t('worker.queue.search.sequence')} search={state.search}
    onSearchChange={value => controller.searchChanged(value)} onSelect={id => controller.selectApparatus(id)}
    loading={state.loading} onMenu={drawer.open}
    onBack={() => { if (router.canGoBack()) router.back(); else router.navigate('/ios-material' as Href); }}
    onProfile={() => router.navigate('/ios-material/profile' as Href)}>
    {(tabId, pagerGesture, machinePicker) => <OrdersList active={tabId === state.selectedApparatus?.id}
      pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={controller.refresh}>
      <HStack modifiers={[frame({ minHeight: 44 })]}>{machinePicker}</HStack>
      {!!state.error && <Section><Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Button label={localizedGetter('retry', locale)} onPress={() => { void controller.refresh(); }} />
      </Section>}
      {!state.loading && !state.error && !rows.length && <Text>{emptyMessage}</Text>}
      {rows.map((order, index) => {
        const item = materialSequencePresentation(order, state.snapshot, locale);
        return <OrderListItem key={order.map.id} session={session} orderId={order.map.id} imageId={order.map.image_id}
          imageActive={tabId === state.selectedApparatus?.id} headline={`${positionFor(order)}. ${[item.code, item.title].filter(Boolean).join(' • ')}`}
          cardTone={toneFor(order)} supportingText={item.subtitle} first={index === 0} last={index === rows.length - 1}
          onPress={() => openDetail(order)} onLongPress={() => assignOrder(order)} />;
      })}
    </OrdersList>}
  </OrdersWorkspace>;
}
