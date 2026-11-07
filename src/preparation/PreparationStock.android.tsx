import { Box, Column, DropdownMenu, DropdownMenuItem, Host, RNHostView, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { size } from '@expo/ui/jetpack-compose/modifiers';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import type { RoleFabAction } from '../shared/navigation/RoleFab.android';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { preparationReverseReceipt } from './preparationCommandApi';
import { usePreparationContext } from './PreparationContext.android';
import { preparationCreateWarehouse, preparationDeleteWarehouse, preparationRenameWarehouse } from './preparationManagementApi';
import { preparationMaterialAvailable, preparationReceiptMode,
  preparationReverseHistory, preparationVisibleMaterials, type PreparationMaterial } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { preparationHistoryCard, preparationReceiptReverseMessage } from './preparationHistoryModel';
import { PreparationNotice } from './PreparationNotice';
import { usePreparationFab } from './PreparationFab.android';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker.android';
import { PreparationWarehouseCreateDialog } from './PreparationWarehouseCreateDialog';
import { preparationWarehouseDeleteMessage, preparationWarehouseErrorMessage } from './preparationWarehousePresentation';
import { usePreparationNotice } from './usePreparationNotice';
import { usePreparationStockActions } from './usePreparationStockActions.android';
import { openPreparationScale } from './preparationNavigation.android';
import { PreparationButton, PreparationDock, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

function useStockReturnReload(controller: ReturnType<typeof usePreparationContext>['home']['controller']) {
  useFocusEffect(useCallback(() => { void controller.loadForPage(); }, [controller]));
}

function WarehouseMaterialRow({ item, warehouse, last }: { item: PreparationMaterial; warehouse: string; last: boolean }) {
  const colors = useMaterialColors(), t = usePreparationText();
  const subtitle = `${t('Mavjud qoldiq')}: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`;
  return <WorkerQueueCard backgroundColor={colors.surface} last={last}
    onPress={() => router.push({ pathname: '/android-preparation/material', params: { code: item.code, warehouse } } as unknown as Href)}>
    <View accessible={false} style={[styles.materialIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'inventory_2' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.materialText}>
      <Text numberOfLines={1} style={[styles.headline, { color: colors.onSurface }]}>{item.name}</Text>
      <Text numberOfLines={1} style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
    </View>
  </WorkerQueueCard>;
}

const passthroughListItems = () => true;

// @v2 PreparationWarehouseScreen
export function PreparationWarehouseScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const sheet = useNativeSheet(), notice = usePreparationNotice(), afterAction = useRef<(() => void) | null>(null);
  useStockReturnReload(home.controller);
  const { receive, createMaterial } = usePreparationStockActions(notice);
  const [query, setQuery] = useState(''), [managing, setManaging] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const data = home.snapshot, warehouse = home.warehouse;
  const materials = preparationVisibleMaterials(data?.materials ?? [], warehouse, query);
  const manual = preparationReceiptMode(warehouse, data?.material_warehouses ?? []) === 'manual';
  const createWarehouse = (name: string, parent: string) => {
    setShowCreate(false);
    void (async () => {
      setManaging(true);
      try {
        const created = await preparationCreateWarehouse(session, name, parent);
        if (!created) return;
        await home.controller.reload(); home.controller.selectWarehouse(created);
        notice.show(t(`Ombor ochildi: ${created}`));
      } catch (error) { notice.show(t(preparationWarehouseErrorMessage(error))); }
      finally { setManaging(false); }
    })();
  };
  const manage = async (kind: 'rename' | 'delete', target: string) => {
    if (!data || managing || home.locked) return;
    try {
      if (kind === 'rename') {
        const name = await dialogs.input({ title: 'Ombor nomini o‘zgartirish', label: 'Ombor nomi', initial: target });
        if (name === null) return;
        setManaging(true);
        const wasSelected = home.controller.getSnapshot().warehouse === target;
        const renamed = await preparationRenameWarehouse(session, target, name);
        await home.controller.reload(); if (wasSelected) home.controller.selectWarehouse(renamed);
        notice.show(t('Ombor nomi o‘zgartirildi'));
      } else {
        if (!(await dialogs.confirm('Omborni o‘chirish', preparationWarehouseDeleteMessage(target), 'O‘chirish'))) return;
        setManaging(true);
        const wasSelected = home.controller.getSnapshot().warehouse === target;
        await preparationDeleteWarehouse(session, target);
        await home.controller.reload();
        const first = home.controller.getSnapshot().snapshot?.assigned_warehouses[0];
        if (wasSelected && first) home.controller.selectWarehouse(first);
        notice.show(t('Ombor o‘chirildi'));
      }
    } catch (error) { notice.show(t(preparationWarehouseErrorMessage(error))); }
    finally { setManaging(false); }
  };
  const warehouseMenu = (target: string) => {
    if (!data?.managed_warehouses.includes(target) || home.locked || managing) return;
    sheet.open(<View style={{ padding: 16, gap: 10 }}><PreparationText title>{target}</PreparationText>
      <PreparationRow title={t('Nomini o‘zgartirish')} onPress={() => { afterAction.current = () => { void manage('rename', target); }; sheet.close(); }} />
      <PreparationRow title={t('O‘chirish')} onPress={() => { afterAction.current = () => { void manage('delete', target); }; sheet.close(); }} />
    </View>, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterAction.current; afterAction.current = null; next?.();
    } });
  };
  const pickReceipt = () => {
    let selected: PreparationMaterial | null = null;
    sheet.open(<PreparationSeriyoPicker title="Homashyo tanlang" materials={materials}
      subtitle={item => `Mavjud: ${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`}
      choose={material => { selected = material; sheet.close(); }} />,
    { dismissible: true, onDismiss: () => { if (selected) void receive(selected); } });
  };
  const fabActions: RoleFabAction[] = [
    ...(warehouse && manual ? [
      { id: 'receive', label: t('Kirim'), icon: 'add_circle' as const, width: 164 },
      { id: 'material', label: t('Homashyo qo‘shish'), icon: 'add' as const, width: 240 },
    ] : warehouse ? [{ id: 'scale', label: t('Tarozi kirimi'), icon: 'scale' as const, width: 210 }] : []),
    ...(data?.assigned_warehouses.length && data.material_warehouses.length
      ? [{ id: 'warehouse', label: t('Ombor qo‘shish'), icon: 'warehouse' as const, width: 220 }] : []),
  ];
  const selectFabAction = (id: string) => {
    if (home.locked || managing) return;
    if (id === 'receive' && warehouse && manual) pickReceipt();
    else if (id === 'material' && warehouse && manual) void createMaterial();
    else if (id === 'scale' && warehouse && !manual) openPreparationScale({ warehouse });
    else if (id === 'warehouse' && data?.assigned_warehouses.length && data.material_warehouses.length) setShowCreate(true);
  };
  const setDockHeight = usePreparationFab('warehouse', { actions: fabActions, onSelect: selectFabAction,
    enabled: !home.locked && !managing, visible: !!fabActions.length || home.loading,
    openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish') });
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersHeader search={query} searchPlaceholder={t('Qidirish')} onSearchChange={setQuery}
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }}
      onProfile={() => router.navigate('/android-preparation/profile' as Href)} />
    <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={passthroughListItems}
      onRefresh={async () => { if (!home.loading && !home.saving) await home.controller.reload(); }}>
    {home.error ? <><PreparationRow title={t('Xatolik yuz berdi')} subtitle={home.error} />
      <PreparationButton label="Qayta urinish" onPress={() => { void home.controller.reload(); }} /></> : null}
    {!!data?.assigned_warehouses.length && <DropdownFilter label={t('Ombor')} selectedLabel={warehouse ?? t('Tanlanmagan')}
      backgroundColor={colors.surface} last={!materials.length} options={data.assigned_warehouses.map(name => ({
        value: name, label: name,
        onLongPress: data.managed_warehouses.includes(name) && !home.locked && !managing ? () => warehouseMenu(name) : undefined,
      }))} onChange={name => home.controller.selectWarehouse(name)} />}
    {data && (!data.assigned_warehouses.length || !warehouse || !materials.length) ? <View style={styles.empty}>
      <PreparationText>{t(!data.assigned_warehouses.length ? 'Sizga ombor biriktirilmagan.'
        : !warehouse ? 'Yuqoridagi filtrdan ombor tanlang.' : 'Bu omborda hali kirim yo‘q.')}</PreparationText>
    </View> : null}
    {warehouse && materials.map((item, index) => <WarehouseMaterialRow key={item.code} item={item} warehouse={warehouse} last={index === materials.length - 1} />)}
    {fabActions.length ? <View style={styles.fabSpace} /> : null}
    </OrdersList>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    <PreparationNotice message={notice.message} />
    {showCreate && data && <PreparationWarehouseCreateDialog warehouses={data.material_warehouses} selected={warehouse}
      close={() => setShowCreate(false)} create={createWarehouse} />}
  </View>;
}

const styles = StyleSheet.create({
  materialIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  materialText: { flex: 1, marginStart: 16 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false, fontWeight: '500' },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  empty: { paddingHorizontal: 24, paddingVertical: 16 },
  fabSpace: { height: 112 },
  historyMenuAnchor: { position: 'absolute', top: 0, right: 0, width: 48, height: 48 },
  historyMenuOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});

// @v2 PreparationHistoryScreen
export function PreparationHistoryScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  const setDockHeight = usePreparationFab(null, { actions: [], onSelect: () => {}, enabled: false, visible: true,
    openLabel: t('Amallarni ochish'), closeLabel: t('Amallarni yopish') });
  const notice = usePreparationNotice();
  const [query, setQuery] = useState('');
  const [optimistic, setOptimistic] = useState<{ snapshot: typeof home.snapshot; history: Record<string, unknown>[] } | null>(null);
  const history = optimistic && optimistic.snapshot === home.snapshot ? optimistic.history : home.snapshot?.history ?? [];
  useEffect(() => { void home.controller.loadForPage(); }, [home.controller]);
  const reverse = async (doc: Record<string, unknown>) => {
    const reason = await dialogs.input({ title: 'Kirimni bekor qilish', label: 'Sabab', emptyError: 'Sabab kiriting', maxLength: 500 });
    if (reason === null || !(await dialogs.confirm('Kirimni bekor qilish', preparationReceiptReverseMessage(doc), 'Bekor qilish', 'Qaytish'))) return;
    try {
      const id = doc.id == null ? null : String(doc.id);
      const result = await preparationReverseReceipt(session, id ?? '', reason);
      const snapshot = home.controller.getSnapshot().snapshot;
      setOptimistic(current => {
        const entries = current && current.snapshot === snapshot ? current.history : snapshot?.history ?? [];
        return { snapshot, history: preparationReverseHistory(entries, id, result, new Date().toISOString()) };
      });
      await home.controller.reload(); notice.show(t('Kirim bekor qilindi'));
    } catch (error) { notice.show(String(error)); }
  };
  const search = query.trim().toLowerCase();
  const entries = history.map(doc => ({ doc, card: preparationHistoryCard(doc) })).filter(({ card }) =>
    !search || `${card.title} ${card.subtitle} ${card.value}`.toLowerCase().includes(search));
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersHeader search={query} searchPlaceholder={t('Qidirish')} onSearchChange={setQuery}
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }}
      onProfile={() => router.navigate('/android-preparation/profile' as Href)} />
    <OrdersList active headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} passthrough={passthroughListItems}
      onRefresh={async () => { await home.controller.reload(); }}>
    {home.error ? <><PreparationRow title={t('Xatolik yuz berdi')} subtitle={home.error} />
      <PreparationButton label="Qayta urinish" onPress={() => { void home.controller.reload(); }} /></> : null}
    <View style={styles.empty}><PreparationText>{t('Oxirgi 100 ta kirim va sarf')}</PreparationText></View>
    {home.loading && !home.snapshot ? <ActivityIndicator /> : null}
    {home.snapshot && !home.error && !entries.length ? <View style={styles.empty}><PreparationText>{t(search ? 'Tarixda hech narsa topilmadi.' : 'Hali kirim yoki sarf yo‘q.')}</PreparationText></View> : null}
    {entries.map(({ doc, card }, index) => <HistoryRow key={`${String(doc.id ?? '')}-${index}`} title={card.title}
      subtitle={`${card.subtitle}\n${card.value}`} first={index === 0} last={index === entries.length - 1}
      canReverse={doc.can_reverse === true}
      onReverse={doc.kind === 'receipt' && doc.reversed !== true ? () => { void reverse(doc); } : undefined} />)}
    </OrdersList>
    <View onLayout={event => setDockHeight(event.nativeEvent.layout.height)}><PreparationDock /></View>
    <PreparationNotice message={notice.message} /></View>;
}

function HistoryMenu({ canReverse, close, select }: { canReverse: boolean; close: () => void; select: () => void }) {
  const colors = useMaterialColors(), t = usePreparationText(), [ready, setReady] = useState(false);
  return <Host pointerEvents="none" style={styles.historyMenuOverlay} onLayoutContent={({ nativeEvent }) => {
    if (!ready && nativeEvent.width > 0 && nativeEvent.height > 0) setReady(true);
  }}>
    <DropdownMenu expanded={ready} onDismissRequest={close}>
      <DropdownMenu.Trigger><Box modifiers={[size(48, 48)]} /></DropdownMenu.Trigger>
      <DropdownMenu.Items>
        <DropdownMenuItem enabled={canReverse} onClick={select}>
          <DropdownMenuItem.LeadingIcon><RNHostView matchContents><SymbolView name={{ android: 'undo' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView></DropdownMenuItem.LeadingIcon>
          <DropdownMenuItem.Text><Column verticalArrangement={{ spacedBy: 4 }}>
            <ComposeText>{t('Kirimni bekor qilish')}</ComposeText>
            <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{t(canReverse
              ? 'Ishlatilmagan va orderga ulanmagan kirim' : 'Bu kirim ishlatilgan yoki orderga ulangan')}</ComposeText>
          </Column></DropdownMenuItem.Text>
        </DropdownMenuItem>
      </DropdownMenu.Items>
    </DropdownMenu>
  </Host>;
}

function HistoryRow({ title, subtitle, first, last, canReverse, onReverse }: { title: string; subtitle: string; first: boolean; last: boolean;
  canReverse: boolean; onReverse?: () => void }) {
  const colors = useMaterialColors();
  const [expanded, setExpanded] = useState(false);
  const select = () => { setExpanded(false); if (canReverse && onReverse) requestAnimationFrame(onReverse); };
  return <WorkerQueueCard first={first} last={last} backgroundColor={colors.surface} onLongPress={onReverse ? () => setExpanded(true) : undefined}>
    <View accessible={false} style={[styles.materialIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'history' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.materialText}><Text style={[styles.headline, { color: colors.onSurface }]}>{title}</Text>
      <Text style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{subtitle}</Text></View>
    {expanded && onReverse ? <View pointerEvents="none" style={styles.historyMenuAnchor}>
      <HistoryMenu canReverse={canReverse} close={() => setExpanded(false)} select={select} />
    </View> : null}
  </WorkerQueueCard>;
}
