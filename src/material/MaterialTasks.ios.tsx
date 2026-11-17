import { Button, HStack, Picker, ProgressView, Section, Text } from '@expo/ui/swift-ui';
import { disabled, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useSharedValue } from 'react-native-reanimated';
import { productionText } from '../shared/localization';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { materialTaskEmptyMessage, materialTaskRowPresentation, materialTaskSummary } from '../shared/supplyTasks/supplyTasksPresentation';
import type { MaterialTasksProps } from './materialTasksProps';
import { useMaterialTasksView } from './useMaterialTasksView';

/** @v2 _SupplyTasksScreenState */
export function MaterialTasks({ controller, session, locale, onMenu, onProfile, handlers }: MaterialTasksProps) {
  const { state, openDetail, openReceive } = useMaterialTasksView(controller, handlers);
  const window = state.window, t = (key: string, values: Record<string, unknown> = {}) => productionText(key, locale, values);
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  return <OrdersWorkspace session={session} title="Material vazifalari" searchPlaceholder="Material vazifalari"
    tabs={window?.apparatus ?? []} selected={window?.apparatus_id ?? ''} search={state.searchInput}
    onSearchChange={value => { controller.setSearchInput(value); }}
    onSelect={id => { if (controller.canInteract()) void controller.selectApparatus(id); }}
    onMenu={() => { if (controller.canInteract()) onMenu(); }} onProfile={() => { if (controller.canInteract()) onProfile(); }}>
    {(tabId, pagerGesture, machinePicker) => <OrdersList active={tabId === window?.apparatus_id} pagerGesture={pagerGesture}
      headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={() => controller.refresh()}>
      {state.loading ? <ProgressView /> : <>
        {!!state.error && <Section><Button label="Material vazifalari yuklanmadi" onPress={() => { void controller.refresh(); }} /></Section>}
        {window && <>
          <Section><HStack modifiers={[frame({ minHeight: 44 })]}><Text>{t('worker.queue.filter.apparatus')}</Text>{machinePicker}</HStack>
            <Picker label={t('qolip.tasks.check')} selection={window.limit} onSelectionChange={value => {
              if (typeof value === 'number') void controller.selectLimit(value);
            }} modifiers={[pickerStyle('menu'), disabled(!controller.canInteract())]}>
              {[5, 10, 20, 50].map(count => <Text key={count} modifiers={[tag(count)]}>{t('qolip.tasks.count', { count })}</Text>)}
            </Picker><Text>{materialTaskSummary(window)}</Text>
          </Section>
          <Section>{!window.rows.length ? <Text>{materialTaskEmptyMessage(window, locale)}</Text> : window.rows.map((row, index) => {
            const item = materialTaskRowPresentation(row, locale);
            return openDetail ? <OrderListItem key={`${row.id}:${index}`} session={session} orderId={row.id} imageId={row.image_id}
              imageActive={controller.canInteract()} headline={`${item.position}. ${[item.code, item.title].filter(Boolean).join(' • ')}`}
              supportingText={item.subtitle} statusText={item.status} statusDetail={item.subtitle}
              onPress={() => openDetail(window, row)} onLongPress={openReceive ? () => openReceive(window, row) : undefined}
              first={index === 0} last={index === window.rows.length - 1} /> : <Text key={`${row.id}:${index}`}>
                {[String(item.position), item.code, item.title, item.subtitle, item.status].filter(Boolean).join(' • ')}
              </Text>;
          })}</Section>
        </>}
      </>}
    </OrdersList>}
  </OrdersWorkspace>;
}
