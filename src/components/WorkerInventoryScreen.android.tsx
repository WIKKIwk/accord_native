import { Button, Host, LazyColumn, ListItem, PullToRefreshBox, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { combinedClickable, fillMaxSize, fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import type { MovementTab } from '../shared/inventoryMovementModel';
import { WorkerAlert } from './WorkerAlert';
import { WorkerFormField } from './WorkerFormField';
import { WorkerInventoryScanner } from './WorkerInventoryScanner';
import { WorkerInventorySheet } from './WorkerInventorySheet';
import { WorkerSheetButton } from './WorkerSheetButton';
import { useWorkerInventorySurface } from './useWorkerInventorySurface';
import { useWorkerInventoryKey } from './useWorkerInventory';

/** @v2 InventoryMovementsScreen */
export function WorkerInventoryScreen(props: { session: Session; onBack: () => void }) { const key = useWorkerInventoryKey(props.session); return <InventoryOwner key={key} {...props} />; }
function InventoryOwner({ session, onBack }: { session: Session; onBack: () => void }) {
  const surface = useWorkerInventorySurface(session), { state, owner, t } = surface, colors = useMaterialColors();
  const tabs = [{ id: 'assets', name: 'Mahsulotlar' }, { id: 'incoming', name: 'Kiruvchi' }, { id: 'outgoing', name: 'Chiquvchi' }];
  if (!surface.valid) return <Host style={{ flex: 1 }}><Text>{t('Inventar ruxsatlari o‘zgardi. Hisobni yangilang.')}</Text></Host>;
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.surface }}>
    <WorkerSheetButton label={t('Orqaga')} onPress={onBack} />
    {state.selected.size ? <View style={{ padding: 12 }}>
      <WorkerSheetButton label={t(`${state.selected.size} ta tanlandi`)} onPress={() => owner.clearSelection()} />
      <WorkerSheetButton label={t('State’ga ko‘chirish')} disabled={state.busy.has('relocate-batch')} onPress={surface.relocateSelected} />
    </View> : <View style={{ padding: 12 }}><WorkerFormField label={t('Mahsulot, kod yoki QR qidirish')} onChangeText={value => owner.search(value)} /></View>}
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row modifiers={[fillMaxWidth()]}>
      {tabs.map(tab => <Button key={tab.id} onClick={() => owner.setTab(tab.id as MovementTab)} enabled={state.tab !== tab.id}><Text>{t(tab.name)}</Text></Button>)}
    </Row></Host>
    <DropdownFilter label={t('Ombor')} selectedLabel={owner.warehouses.find(row => row.warehouse_id === state.warehouse)?.name ?? t('Tanlanmagan')}
      backgroundColor={colors.surface} options={owner.warehouses.map(row => ({ value: row.warehouse_id, label: row.name }))} onChange={value => owner.selectWarehouse(value)} />
    {state.scanning ? <WorkerInventoryScanner surface={surface} /> : null}
    {surface.loading ? <ActivityIndicator /> : null}
    <Host style={{ flex: 1 }}><PullToRefreshBox modifiers={[fillMaxSize()]} isRefreshing={surface.loading} onRefresh={() => { void owner.refresh(); }}>
      <LazyColumn modifiers={[fillMaxSize()]} contentPadding={{ bottom: 16 }}>
        {!!state.error && <Text modifiers={[padding(16, 16, 16, 16)]}>{t(state.error)}</Text>}
        {state.error ? <Button onClick={() => { void owner.refresh(); }}><Text>{t('Qayta urinish')}</Text></Button> : null}
        {state.scanning || state.tab === 'assets' ? surface.rows.map(row => <ListItem key={row.key} modifiers={[
          combinedClickable({ onClick: row.open, ...(row.selectable ? { onLongClick: row.hold } : {}) }),
        ]}>
          <ListItem.HeadlineContent><Text>{row.title}</Text></ListItem.HeadlineContent>
          <ListItem.SupportingContent><Text>{row.supporting}</Text></ListItem.SupportingContent>
          {row.selected ? <ListItem.TrailingContent><Text>✓</Text></ListItem.TrailingContent> : null}
        </ListItem>) : surface.transfers.map(row => <ListItem key={row.key} modifiers={[combinedClickable({ onClick: row.open })]}>
          <ListItem.HeadlineContent><Text>{row.title}</Text></ListItem.HeadlineContent>
          <ListItem.SupportingContent><Text>{`${t(row.status)}\n${row.supporting}`}</Text></ListItem.SupportingContent>
        </ListItem>)}
        {!surface.loading && !state.error && !(state.scanning || state.tab === 'assets' ? surface.rows.length : surface.transfers.length) ? <Text modifiers={[padding(20, 20, 20, 20)]}>{t(surface.empty)}</Text> : null}
        {!!state.notice && <Text modifiers={[padding(12, 12, 12, 12)]}>{t(state.notice)}</Text>}
      </LazyColumn>
    </PullToRefreshBox></Host>
    {!state.scanning ? <WorkerSheetButton label={t('QR orqali izlash')} onPress={() => owner.toggleScanning()} /> : null}
    <WorkerInventorySheet session={session} surface={surface} />
    <WorkerAlert alert={surface.alert} onDismiss={surface.dismissAlert} />
  </SafeAreaView>;
}
