import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { localizedGetter, productionText } from '../shared/localization';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { useQolipTasks } from './useQolipTasks';
import { useQolipRole } from './QolipRoleContext';
import { useQolipText } from './useQolipText';
/** @v2 _SupplyTasksScreenState */
export function QolipTasksScreen() {
  const { state, controller, refresh, attach } = useQolipTasks(), role = useQolipRole(), { text, locale } = useQolipText(), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const offset = useSharedValue(0), height = useSharedValue(0), window = state.window;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.surfaceContainerLow }}>
    <OrdersHeader search={state.searchInput} searchPlaceholder={text('nav.tasks')} onSearchChange={controller.setSearchInput.bind(controller)} onMenu={role.onMenu} onProfile={role.onProfile} />
    {state.loading ? <ActivityIndicator /> : <OrdersList active passthrough={() => true} headerOffset={offset} headerHeight={height} topInset={0} onRefresh={refresh}>
      {!!state.error && <View style={{ padding: 24, gap: 12 }}><Text style={{ color: colors.onSurfaceVariant }}>{text('tasks.load_failed')}</Text><WorkerSheetButton label={localizedGetter('retry', locale)} onPress={() => { void refresh(); }} /></View>}
      {window && <><DropdownFilter label={productionText('worker.queue.filter.apparatus', locale)} selectedLabel={window.apparatus.find(item => item.id === window.apparatus_id)?.name ?? productionText('worker.queue.filter.unselected', locale)}
        options={window.apparatus.map(item => ({ value: item.id, label: item.name }))} backgroundColor={colors.surface} onChange={id => {
          const selected = window.apparatus.find(item => item.id === id); if (selected) void adminSequenceApparatusStore.saveApparatus(selected); void controller.selectApparatus(id);
        }} />
        <DropdownFilter label={text('tasks.check')} selectedLabel={text('tasks.count', { count: window.limit })} options={[5,10,20,50].map(count => ({ value: count, label: text('tasks.count', { count }) }))}
          backgroundColor={colors.surface} onChange={count => { void controller.selectLimit(count); }} last />
        <Text style={{ color: colors.onSurfaceVariant, padding: 12 }}>{text('tasks.summary', { count: window.checked_count, missing: window.missing_count })}</Text>
        {!window.rows.length && <Text style={{ color: colors.onSurfaceVariant, padding: 24, textAlign: 'center' }}>{text(window.checked_count === 0 ? 'tasks.no_orders' : window.missing_count === 0 ? 'tasks.ready' : 'products.search_empty')}</Text>}
        {window.rows.map((row, index) => <OrderListItem key={row.id} session={role.session} orderId={row.id} imageId={row.image_id} imageActive last={index === window.rows.length - 1}
          headline={String(row.position + 1) + '. ' + (row.code || row.order_number || row.id) + ' · ' + row.title}
          supportingText={[row.customer_name.trim() || row.product_code.trim(), row.apparatus_count > 0 ? productionText('worker.queue.apparatus_count', locale, { count: row.apparatus_count }) : '', text('tasks.attach')].filter(Boolean).join(' • ')} onPress={() => { void attach(row.id); }} />)}
      </>}
    </OrdersList>}{role.dock}
  </View>;
}
