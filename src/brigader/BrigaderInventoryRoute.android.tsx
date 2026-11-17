import { Host, IconButton, RNHostView, SnackbarHost, useMaterialColors, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Redirect, router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminShell } from '../admin/AdminShellContext';
import { AdminCreateMenu } from '../admin/AdminCreateMenu.android';
import { WorkerAlert } from '../components/WorkerAlert';
import { WorkerInventoryScanner } from '../components/WorkerInventoryScanner';
import { WorkerInventorySheet } from '../components/WorkerInventorySheet';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { appRoutes, homeRoute } from '../shared/appRoutes';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import type { MovementTab } from '../shared/inventoryMovementModel';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { useBrigaderInventorySurface } from './useBrigaderInventorySurface';

const tabs: MovementTab[] = ['assets', 'incoming', 'outgoing'];
const passthrough = () => true;

/** Reuse the existing native worker list, search, tabs, warehouse filter, sheets and scanner. */
export function BrigaderInventoryRoute() {
  const shell = useAdminShell(), surface = useBrigaderInventorySurface(), { owner, state, t } = surface;
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(70);
  const [headerSize, setHeaderSize] = useState(70);
  const snackbar = useRef<SnackbarHostRef>(null);
  useEffect(() => {
    if (!state.notice || !owner.current()) return;
    void snackbar.current?.showSnackbar({ message: t(state.notice), duration: 'short' }); owner.clearNotice();
  }, [state.notice, owner, t]);
  const goBack = useCallback(() => {
    if (!shell.isCurrent()) return;
    if (router.canGoBack()) router.back();
    else { const home = shell.destination(homeRoute(shell.session), 'android'); if (home) router.replace(home as Href); }
  }, [shell]);
  const actions = useMemo(() => [{ id: 'inventory-qr-search', label: t('QR orqali izlash'),
    icon: { android: 'qr_code_scanner' as const, ios: 'qrcode.viewfinder' as const }, onPress: () => owner.openScanning() }], [owner, t]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; }); return () => sub.remove(); }, [goBack]);
  if (!shell.isCurrent()) return <View style={{ flex: 1 }} />;
  if (!shell.destination(appRoutes.inventoryMovements, 'android')) return <Redirect href="/" />;
  const header = <View onLayout={event => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}>{state.selected.size ? <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 10, gap: 8 }}>
    <WorkerIconButton icon="close" label={t('Tanlashni bekor qilish')} onPress={() => owner.clearSelection()} size={48} />
    <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.onSurface }}>{t(`${state.selected.size} ta tanlandi`)}</Text>
    <Host matchContents><IconButton enabled={!state.busy.has('relocate-batch')} onClick={surface.relocateSelected}
      modifiers={[semantics({ contentDescription: t('State’ga ko‘chirish') })]}><RNHostView matchContents>
      {state.busy.has('relocate-batch') ? <ActivityIndicator /> : <SymbolView name={{ android: 'swap_horiz' }} size={24} tintColor={colors.onSurfaceVariant} />}
    </RNHostView></IconButton></Host>
  </View> : <OrdersHeader search={state.query} searchPlaceholder={t('Mahsulot, kod yoki QR qidirish')}
    onSearchChange={value => owner.search(value)} onBack={goBack} onProfile={() => {
      const path = shell.isCurrent() ? shell.destination(appRoutes.profile, 'android') : null;
      if (path) router.push(path as Href);
    }} />}</View>;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersWorkspace session={shell.session} tabs={tabs.map(id => ({ id, name: t(id === 'assets' ? 'Mahsulotlar' : id === 'incoming' ? 'Kiruvchi' : 'Chiquvchi') }))}
      selected={state.tab} distributeTabs header={header} headerOffset={headerOffset} onSelect={value => {
        if (tabs.includes(value as MovementTab)) owner.setTab(value as MovementTab);
      }}>
      {(id, pagerGesture) => {
        const active = state.tab === id, assets = id === 'assets', scanning = active && state.scanning;
        const rows: readonly (typeof surface.rows[number] | typeof surface.transfers[number])[] = scanning || assets ? surface.rows : surface.transfers;
        return <OrdersList active={active} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight}
          topInset={headerSize + 48} passthrough={passthrough} onRefresh={() => owner.refresh()}>
          {!scanning ? <DropdownFilter label={t('Ombor')} selectedLabel={owner.warehouses.find(row => row.warehouse_id === state.warehouse)?.name ?? t('Tanlanmagan')}
            backgroundColor={colors.surface} options={owner.warehouses.map(row => ({ value: row.warehouse_id, label: row.name }))}
            onChange={value => owner.selectWarehouse(value)} /> : null}
          {scanning ? <WorkerInventoryScanner surface={surface} /> : null}
          {active && surface.loading ? <ActivityIndicator style={{ padding: 24 }} /> : null}
          {active && state.error ? <View style={{ padding: 16, gap: 12 }}><Text style={{ color: colors.error }}>{t(state.error)}</Text>
            <WorkerSheetButton label={t('Qayta urinish')} onPress={() => { void owner.refresh(); }} /></View> : null}
          {active && rows.map((row, index) => <WorkerQueueCard key={row.key} backgroundColor={colors.surfaceContainerLowest}
            first={index === 0} last={index === rows.length - 1} onPress={row.open}
            style={{ height: 61, paddingLeft: 14, paddingRight: 10, paddingVertical: 8 }} containerStyle={{ paddingHorizontal: 4 }}
            {...('hold' in row && row.selectable ? { onLongPress: row.hold } : {})}>
            {'asset' in row ? <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }}>
              <SymbolView name={{ android: row.selected ? 'check' : row.asset.kind === 'qolip' ? 'view_in_ar' : row.asset.kind === 'finished_goods' ? 'inventory_2' : 'category' }} size={16} tintColor={colors.onSecondaryContainer} />
            </View> : null}
            <View style={{ flex: 1, paddingHorizontal: 10, gap: 3 }}><Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.onSurface }}>{row.title}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.onSurfaceVariant }}>{row.supporting}</Text></View>
          </WorkerQueueCard>)}
          {active && !surface.loading && !state.error && !rows.length ? <Text style={{ padding: 28, textAlign: 'center', color: colors.onSurfaceVariant }}>{t(surface.empty)}</Text> : null}
          <View style={{ height: insets.bottom + 108 }} />
        </OrdersList>;
      }}
    </OrdersWorkspace>
    <AdminCreateMenu actions={actions} isCurrent={owner.current} openLabel={t('Amallar')} closeLabel={t('Yopish')} bottomOffset={insets.bottom + 16} />
    <WorkerInventorySheet session={shell.session} surface={surface} showFooter={false} />
    <WorkerAlert alert={surface.alert} onDismiss={surface.dismissAlert} />
    <Host matchContents style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16 }}><SnackbarHost ref={snackbar} /></Host>
  </View>;
}
