import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { preparationReverseReceipt } from './preparationCommandApi';
import { usePreparationContext } from './PreparationContext.android';
import { preparationCreateWarehouse, preparationDeleteWarehouse, preparationRenameWarehouse } from './preparationManagementApi';
import { preparationMaterialAvailable, preparationMaterialHistory, preparationReceiptMode, preparationReceiptPayload,
  preparationReverseHistory, preparationVisibleMaterials, type PreparationMaterial } from './preparationLogic';
import { preparationDisplay } from './preparationModel';
import { preparationHistoryCard, preparationMaterialConsumptionCard, preparationMaterialReceiptCard, preparationReceiptActionSubtitle, preparationReceiptReverseMessage } from './preparationHistoryModel';
import { PreparationNotice } from './PreparationNotice';
import { PreparationSeriyoPicker } from './PreparationSeriyoPicker.android';
import { PreparationWarehouseCreateDialog } from './PreparationWarehouseCreateDialog';
import { preparationWarehouseDeleteMessage, preparationWarehouseErrorMessage } from './preparationWarehousePresentation';
import { usePreparationNotice } from './usePreparationNotice';
import { openPreparationScale } from './preparationNavigation.android';
import { PreparationButton, PreparationDock, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

function useStockActions(notice: ReturnType<typeof usePreparationNotice>) {
  const { home } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const receive = async (material: PreparationMaterial, selectedWarehouse = home.warehouse) => {
    if (!selectedWarehouse || !home.snapshot || home.locked) return;
    if (preparationReceiptMode(selectedWarehouse, home.snapshot.material_warehouses) !== 'manual') return;
    const kg = await dialogs.input({ title: `${material.name} — kirim`, label: 'Kirim (kg)', quantity: true });
    if (kg === null) return;
    try { await home.controller.submit('receipts', preparationReceiptPayload(material, selectedWarehouse, kg)); notice.show(t('Saqlandi')); }
    catch (error) { notice.show(String(error)); }
  };
  const createMaterial = async () => {
    if (!home.warehouse || home.locked) return;
    const name = await dialogs.input({ title: 'Yangi homashyo', label: 'Homashyo nomi' });
    if (name === null) return;
    try { await home.controller.submit('materials', { name, warehouse: home.warehouse }); notice.show(t('Saqlandi')); }
    catch (error) { notice.show(String(error)); }
  };
  return { receive, createMaterial };
}

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
  const { receive, createMaterial } = useStockActions(notice);
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
    <View style={styles.actions}>{warehouse && manual ? <>
      <PreparationButton label="Kirim" disabled={home.locked || managing} onPress={pickReceipt} id="preparation-receipt" />
      <PreparationButton label="Homashyo qo‘shish" disabled={home.locked || managing} onPress={() => void createMaterial()} />
    </> : null}
    {warehouse && !manual ? <PreparationButton label="Tarozi kirimi"
      disabled={home.locked || managing} onPress={() => openPreparationScale({ warehouse })} /> : null}
    {data?.assigned_warehouses.length && data.material_warehouses.length ? <PreparationButton label="Ombor qo‘shish" disabled={home.locked || managing} onPress={() => setShowCreate(true)} /> : null}
    </View>
    </OrdersList>
    <PreparationDock /><PreparationNotice message={notice.message} />
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
  actions: { paddingHorizontal: 8, paddingBottom: 12, gap: 8 },
});

// @v2 PreparationMaterialDetailScreen
export function PreparationMaterialDetailScreen() {
  const params = useLocalSearchParams<{ code: string; warehouse?: string }>(), code = params.code;
  const { home } = usePreparationContext(), notice = usePreparationNotice(), t = usePreparationText();
  const { receive } = useStockActions(notice);
  useStockReturnReload(home.controller);
  const item = home.snapshot?.materials.find(material => material.code === code);
  const warehouse = params.warehouse ?? home.warehouse;
  const history = preparationMaterialHistory(home.snapshot?.history ?? [], warehouse ?? '', code ?? '');
  const manual = preparationReceiptMode(warehouse, home.snapshot?.material_warehouses ?? []) === 'manual';
  return <View style={{ flex: 1 }}><PreparationPage title={item?.name ?? 'Homashyo'} subtitle={warehouse ?? undefined} refreshing={home.loading} onRefresh={() => { if (!home.loading && !home.saving) void home.controller.reload(); }}>
    {item ? <PreparationRow title={item.name} subtitle={`${item.code}\n${preparationDisplay(preparationMaterialAvailable(item, warehouse))} kg`} /> : null}
    {manual ? <PreparationButton label="Kirim qilish" disabled={home.locked || !item || !item.can_receive} onPress={() => { if (item) void receive(item, warehouse); }} />
      : <PreparationButton label="Tarozi kirimi" disabled={home.locked || !item} onPress={() => openPreparationScale({ warehouse })} />}
    {!history.receipts.length && !history.consumptions.length ? <PreparationText>{t('Bu homashyo bo‘yicha hali kirim yoki chiqim yo‘q.')}</PreparationText> : null}
    {history.receipts.length ? <PreparationText title>{t('Kirimlar')}</PreparationText> : null}
    {history.receipts.map((doc, index) => { const card = preparationMaterialReceiptCard(doc, item?.name);
      return <PreparationRow key={`${String(doc.id ?? '')}-${index}`} title={card.title} subtitle={[card.subtitle, card.value].filter(Boolean).join('\n')} />; })}
    {history.consumptions.length ? <PreparationText title>{t('Chiqimlar')}</PreparationText> : null}
    {history.consumptions.map(({ doc, line }, index) => { const card = preparationMaterialConsumptionCard(doc, line);
      return <PreparationRow key={`${String(doc.id ?? '')}-${index}`} title={card.title} subtitle={card.subtitle} />; })}
  </PreparationPage><PreparationNotice message={notice.message} /></View>;
}

// @v2 PreparationHistoryScreen
export function PreparationHistoryScreen() {
  const { home, session } = usePreparationContext(), dialogs = usePreparationDialogs(), t = usePreparationText();
  const sheet = useNativeSheet(), notice = usePreparationNotice(), afterSheet = useRef<(() => void) | null>(null);
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
  const openActions = (doc: Record<string, unknown>) => {
    sheet.open(<View style={{ padding: 16, gap: 10 }}>
      <PreparationText title>{`Kirim — ${String(doc.name ?? '')}`}</PreparationText>
      <PreparationText>{preparationReceiptActionSubtitle(doc)}</PreparationText>
      <PreparationRow title={t('Kirimni bekor qilish')} subtitle={t(doc.can_reverse === true
        ? 'Ishlatilmagan va orderga ulanmagan kirim' : 'Bu kirim ishlatilgan yoki orderga ulangan')}
        disabled={doc.can_reverse !== true} onPress={() => { afterSheet.current = () => { void reverse(doc); }; sheet.close(); }} />
      <PreparationRow title={t('Yopish')} onPress={sheet.close} />
    </View>, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterSheet.current; afterSheet.current = null; next?.();
    } });
  };
  return <View style={{ flex: 1 }}><PreparationPage title="Tarix" refreshing={home.loading} onRefresh={() => void home.controller.reload()}>
    {home.error ? <><PreparationRow title={t('Xatolik yuz berdi')} subtitle={home.error} />
      <PreparationButton label="Qayta urinish" onPress={() => { void home.controller.reload(); }} /></> : null}
    <PreparationText>{t('Oxirgi 100 ta kirim va sarf')}</PreparationText>
    {home.snapshot && !history.length ? <PreparationText>{t('Hali kirim yoki sarf yo‘q.')}</PreparationText> : null}
    {history.map((doc, index) => {
      const card = preparationHistoryCard(doc);
      return <PreparationRow key={`${String(doc.id ?? '')}-${index}`} title={card.title} subtitle={`${card.subtitle}\n${card.value}`}
        onLongPress={doc.kind === 'receipt' && doc.reversed !== true ? () => openActions(doc) : undefined} />;
    })}
  </PreparationPage><PreparationNotice message={notice.message} /></View>;
}
