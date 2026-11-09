import { Picker, Row, Spacer, Text as NativeText } from '@expo/ui';
import { Button, HStack, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { frame, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { PreparationList } from '../preparation/PreparationUI';
import { productionText } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { materialTaskEmptyMessage, materialTaskRowPresentation, materialTaskSummary } from '../shared/supplyTasks/supplyTasksPresentation';
import type { MaterialTasksProps } from './materialTasksProps';
import { useMaterialTasksView } from './useMaterialTasksView';

/** Source-derived compact material task view; its route, reader and detail/receipt handlers are supplied separately. */
export function MaterialTasks({ controller, locale, onMenu, onProfile, handlers }: MaterialTasksProps) {
  const { state, openDetail, openReceive } = useMaterialTasksView(controller, handlers);
  const window = state.window, t = (key: string, values: Record<string, unknown> = {}) => productionText(key, locale, values);
  return <View style={{ flex: 1 }}>
    <OrdersHeader search={state.searchInput} searchPlaceholder="Material vazifalari" onSearchChange={value => { controller.setSearchInput(value); }}
      onMenu={() => { if (controller.canInteract()) onMenu(); }} onProfile={() => { if (controller.canInteract()) onProfile(); }} />
    <PreparationList refresh={() => controller.refresh()}>
      {state.loading ? <ProgressView /> : <>
        {!!state.error && <Section><Button label="Material vazifalari yuklanmadi" onPress={() => { void controller.refresh(); }} /></Section>}
        {window && <>
          <Section><Row alignment="center" spacing={8}><NativeText>{t('worker.queue.filter.apparatus')}</NativeText><Spacer flexible />
            <Picker selectedValue={window.apparatus_id} enabled={!!window.apparatus.length} onValueChange={id => { if (typeof id === 'string') void controller.selectApparatus(id); }}>
              {!window.apparatus.length && <Picker.Item value="" label={t('worker.queue.filter.unselected')} />}
              {window.apparatus.map(item => <Picker.Item key={item.id} value={item.id} label={item.name} />)}
            </Picker></Row>
            <Row alignment="center" spacing={8}><NativeText>{t('qolip.tasks.check')}</NativeText><Spacer flexible />
              <Picker selectedValue={window.limit} onValueChange={value => { if (typeof value === 'number') void controller.selectLimit(value); }}>
                {[5, 10, 20, 50].map(count => <Picker.Item key={count} value={count} label={t('qolip.tasks.count', { count })} />)}
              </Picker></Row>
            <Text>{materialTaskSummary(window)}</Text>
          </Section>
          <Section>{!window.rows.length ? <Text>{materialTaskEmptyMessage(window, locale)}</Text> : window.rows.map((row, index) => {
            const item = materialTaskRowPresentation(row, locale), modifiers = openReceive ? [onLongPressGesture(() => openReceive(window, row))] : [];
            const content = <HStack spacing={12}><Text>{String(item.position)}</Text><VStack alignment="leading" modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text>{[item.code, item.title].filter(Boolean).join(' • ')}</Text>{!!item.subtitle && <Text>{item.subtitle}</Text>}
            </VStack>{!!item.status && <Text>{item.status}</Text>}</HStack>;
            return openDetail ? <Button key={`${row.id}:${index}`} onPress={() => openDetail(window, row)} modifiers={modifiers}>{content}</Button> :
              <VStack key={`${row.id}:${index}`} modifiers={modifiers}>{content}</VStack>;
          })}</Section>
        </>}
      </>}
    </PreparationList>
  </View>;
}
