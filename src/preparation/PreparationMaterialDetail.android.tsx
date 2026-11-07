import { Column, Host, Row, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, padding, paddingAll, Shapes, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { RoleHeader } from '../shared/navigation/RoleHeader.android';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { usePreparationContext } from './PreparationContext.android';
import { usePreparationFab } from './PreparationFab.android';
import { PreparationNotice } from './PreparationNotice';
import { PreparationButton, PreparationDock, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import { materialStockTabs, type MaterialStockRow, type MaterialStockSummary, type MaterialStockTab } from './preparationMaterialStockApi';
import { materialStockRowPresentation, materialStockTabLabels } from './preparationMaterialStockPresentation';
import { preparationReceiptMode } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { openPreparationScale } from './preparationNavigation.android';
import { usePreparationMaterialStock } from './usePreparationMaterialStock';
import { usePreparationNotice } from './usePreparationNotice';
import { usePreparationStockActions } from './usePreparationStockActions.android';

function StockSummary({ summary }: { summary: MaterialStockSummary | null }) {
  const colors = useMaterialColors(), t = usePreparationText();
  const totals = [
    { label: 'Kirim', value: summary?.receipt_kg, color: colors.primary },
    { label: 'Chiqim', value: summary?.issue_kg, color: colors.error },
    { label: 'Mavjud', value: summary?.available_kg, color: colors.onSurface },
  ];
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><Row horizontalArrangement={{ spacedBy: 8 }}
    modifiers={[fillMaxWidth(), padding(8, 6, 8, 12)]}>
    {totals.map(total => <Column key={total.label} verticalArrangement={{ spacedBy: 4 }} modifiers={[
      weight(1), clip(Shapes.RoundedCorner(16)), background(colors.surface), paddingAll(12),
    ]}>
      <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{t(total.label)}</ComposeText>
      <ComposeText color={total.color} style={{ typography: 'titleMedium' }} maxLines={1} overflow="ellipsis">
        {total.value == null ? '—' : preparationDisplay(total.value)}
      </ComposeText>
      <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'labelSmall' }}>kg</ComposeText>
    </Column>)}
  </Row></Host>;
}

function StockRow({ item, tab, first, last }: { item: MaterialStockRow; tab: MaterialStockTab; first: boolean; last: boolean }) {
  const colors = useMaterialColors(), t = usePreparationText(), dialogs = usePreparationDialogs();
  const row = materialStockRowPresentation(item, tab, t);
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surface} onPress={() => dialogs.message(t('Batafsil ma’lumot'), row.fullDetails)}>
    <View style={styles.rowText}>
      <Text style={[styles.headline, { color: colors.onSurface }]} numberOfLines={1}>{row.title}</Text>
      <Text style={[styles.supporting, { color: colors.onSurfaceVariant }]} numberOfLines={3}>{row.detail}</Text>
    </View>
    <Text style={[styles.amount, { color: tab === 'receipts' ? colors.primary : tab === 'issues' ? colors.error : colors.onSurface }]}>{row.amount}</Text>
  </WorkerQueueCard>;
}
const passthrough = () => true;
const emptyLabels: Record<MaterialStockTab, string> = { available: 'Bu homashyo hozir omborda mavjud emas.', receipts: 'Bu homashyo bo‘yicha kirim topilmadi.', issues: 'Bu homashyo bo‘yicha chiqim topilmadi.' };

export function PreparationMaterialDetailScreen() {
  const params = useLocalSearchParams<{ code: string; warehouse?: string }>();
  const { home, session } = usePreparationContext(), colors = useMaterialColors(), insets = useSafeAreaInsets(), t = usePreparationText();
  const code = params.code ?? '', warehouse = params.warehouse ?? home.warehouse ?? '';
  const state = usePreparationMaterialStock(session, warehouse, code), notice = usePreparationNotice();
  const { receive } = usePreparationStockActions(notice);
  const item = home.snapshot?.materials.find(material => material.code === code);
  const manual = preparationReceiptMode(warehouse, home.snapshot?.material_warehouses ?? []) === 'manual';
  useFocusEffect(useCallback(() => { void home.controller.loadForPage(); }, [home.controller]));
  const setDockHeight = usePreparationFab('material', { actions: item ? [{ id: 'receive', label: t(manual ? 'Kirim qilish' : 'Tarozi kirimi'),
    icon: manual ? 'add_circle' : 'scale', width: 210 }] : [], enabled: !home.locked && !!item && (!manual || item.can_receive), visible: !!item || home.loading,
    onSelect: () => { if (home.locked || !item) return;
      if (manual) void receive(item, warehouse).then(() => state.controller.reload());
      else openPreparationScale({ warehouse });
    }, openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish') });
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(176), [headerSize, setHeaderSize] = useState(176);
  const header = <View onLayout={event => { const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}>
    <RoleHeader title={state.itemName || item?.name || code || t('Homashyo')} subtitle={warehouse} navigation={{ icon: 'back', label: t('Orqaga'),
      onPress: () => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation/warehouse' as Href); } }} />
    <StockSummary summary={state.summary} />
  </View>;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersWorkspace session={session} distributeTabs tabs={materialStockTabs.map(id => ({ id, name: t(materialStockTabLabels[id]) }))}
      selected={state.tab} onSelect={id => { if (materialStockTabs.includes(id as MaterialStockTab)) state.controller.select(id as MaterialStockTab); }}
      header={header} headerOffset={headerOffset}>
      {(id, pagerGesture) => {
        const tab = id as MaterialStockTab, page = state.pages[tab];
        return <OrdersList active={state.tab === tab} pagerGesture={pagerGesture} headerOffset={headerOffset} headerHeight={headerHeight}
          topInset={headerSize + 48} passthrough={passthrough} onRefresh={() => state.controller.reload()}
          onEndReached={() => { if (state.tab === tab && !page.error) void state.controller.loadMore(); }}>
          {page.error ? <View style={styles.status}><PreparationText>{page.error}</PreparationText>
            <PreparationButton label="Qayta urinish" onPress={() => { void state.controller.load(tab, page.loaded); }} /></View> : null}
          {!page.error && !page.loaded && !page.rows.length ? <ActivityIndicator style={styles.status} /> : null}
          {page.loaded && !page.loading && !page.error && !page.rows.length ? <View style={styles.status}><PreparationText>{t(emptyLabels[tab])}</PreparationText></View> : null}
          {page.rows.map((row, index) => <StockRow key={row.id} item={row} tab={tab} first={index === 0} last={index === page.rows.length - 1} />)}
          {page.loaded && page.loading ? <ActivityIndicator style={styles.status} /> : null}
          <View style={styles.fabSpace} />
        </OrdersList>;
      }}
    </OrdersWorkspace>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    <PreparationNotice message={notice.message} />
  </View>;
}

const styles = StyleSheet.create({
  rowText: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  supporting: { fontSize: 13, lineHeight: 20 },
  amount: { fontSize: 16, fontWeight: '500', marginEnd: 8, maxWidth: '42%' },
  status: { padding: 16, gap: 8 }, fabSpace: { height: 112 },
});
