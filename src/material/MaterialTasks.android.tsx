import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { productionText } from '../shared/localization';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { materialTaskEmptyMessage, materialTaskRowPresentation, materialTaskSummary } from '../shared/supplyTasks/supplyTasksPresentation';
import type { MaterialTasksProps } from './materialTasksProps';
import { useMaterialTasksView } from './useMaterialTasksView';

/** Source-derived compact material task view; its route, reader and detail/receipt handlers are supplied separately. */
export function MaterialTasks({ controller, locale, onMenu, onProfile, handlers }: MaterialTasksProps) {
  const { state, openDetail, openReceive } = useMaterialTasksView(controller, handlers);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const window = state.window, selected = window?.apparatus.find(item => item.id === window.apparatus_id);
  const t = (key: string, values: Record<string, unknown> = {}) => productionText(key, locale, values);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <OrdersHeader search={state.searchInput} searchPlaceholder="Material vazifalari" onSearchChange={value => { controller.setSearchInput(value); }}
      onMenu={() => { if (controller.canInteract()) onMenu(); }} onProfile={() => { if (controller.canInteract()) onProfile(); }} />
    <OrdersList onRefresh={() => controller.refresh()} active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={() => true}>
      {state.loading ? <ActivityIndicator /> : <>
        {!!state.error && <WorkerQueueCard first last backgroundColor={colors.surface} onPress={() => { void controller.refresh(); }}>
          <Text style={{ color: colors.onSurface, padding: 12 }}>Material vazifalari yuklanmadi</Text></WorkerQueueCard>}
        {window && <>
          <DropdownFilter label={t('worker.queue.filter.apparatus')} selectedLabel={selected?.name ?? t('worker.queue.filter.unselected')}
            options={window.apparatus.map(item => ({ value: item.id, label: item.name }))} enabled={!!window.apparatus.length}
            backgroundColor={colors.surface} onChange={id => { void controller.selectApparatus(id); }} />
          <DropdownFilter label={t('qolip.tasks.check')} selectedLabel={t('qolip.tasks.count', { count: window.limit })}
            options={[5, 10, 20, 50].map(count => ({ value: count, label: t('qolip.tasks.count', { count }) }))}
            backgroundColor={colors.surface} onChange={count => { void controller.selectLimit(count); }} last />
          <Text style={{ color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingVertical: 8 }}>{materialTaskSummary(window)}</Text>
          {!window.rows.length ? <Text style={{ color: colors.onSurfaceVariant, padding: 24, textAlign: 'center' }}>{materialTaskEmptyMessage(window, locale)}</Text> :
            window.rows.map((row, index) => { const item = materialTaskRowPresentation(row, locale);
              return <WorkerQueueCard key={`${row.id}:${index}`} first={index === 0} last={index === window.rows.length - 1}
                backgroundColor={colors.surface} onPress={openDetail ? () => openDetail(window, row) : undefined}
                onLongPress={openReceive ? () => openReceive(window, row) : undefined}>
                <Text style={{ color: colors.onSurfaceVariant, paddingHorizontal: 8 }}>{item.position}</Text>
                <View style={{ flex: 1, paddingVertical: 8 }}><Text style={{ color: colors.onSurface }} numberOfLines={1}>{[item.code, item.title].filter(Boolean).join(' • ')}</Text>
                  {!!item.subtitle && <Text style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>{item.subtitle}</Text>}</View>
                {!!item.status && <Text style={{ color: colors.onSecondaryContainer, backgroundColor: colors.secondaryContainer, padding: 6 }}>{item.status}</Text>}
              </WorkerQueueCard>;
            })}
        </>}
      </>}
    </OrdersList>
  </View>;
}
