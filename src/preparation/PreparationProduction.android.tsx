import { Image } from 'expo-image';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import qrFactory from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { WorkerIconButton } from '../components/WorkerIconButton';
import { useNativeSheet } from '../nativeSheet';
import { DropdownFilter } from '../shared/filters/DropdownFilter.android';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { ORDERS_TAB_BAR_HEIGHT } from '../shared/orders/ordersWorkspaceTypes';
import { sessionReadScope } from '../sessionReadScope';
import { usePreparationContext } from './PreparationContext.android';
import { type JournalState, PreparationJournal } from './preparationJournal';
import { createPreparationProductionBatchJournal, createPreparationProductionOrderJournal, productionRowKey, productionViews } from './preparationJournalFactory';
import { preparationProductionBatchCard, preparationProductionDate, preparationProductionMetrics, preparationProductionOrderCard,
  preparationProductionRecipeLines, preparationProductionRollCard } from './preparationProductionPresentation';
import { selectPreparationDevice } from './preparationDevicePicker.android';
import { reprintPreparationRollWithPrinter } from './preparationPrinter';
import { PreparationReprintCancelled } from './preparationReprint';
import { PreparationButton, PreparationDialogs, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import type { preparationProductionBatchFromJson, preparationProductionOrderFromJson, preparationProductionRollFromJson } from './preparationProductionModel';
import { PreparationProductionNoteDialog } from './PreparationProductionNoteDialog';
import { usePreparationOutputNotes } from './usePreparationOutputNotes';
import { productionSearchPlaceholder, productionStatuses, usePreparationJournal, usePreparationProductionWorkspace } from './usePreparationProductionWorkspace';

type Order = ReturnType<typeof preparationProductionOrderFromJson>;
type Batch = ReturnType<typeof preparationProductionBatchFromJson>;
type Roll = ReturnType<typeof preparationProductionRollFromJson>;
const passthroughListItems = () => true;
function ProductionOrderRow({ order, last }: { order: Order; last: boolean }) {
  const colors = useMaterialColors(), card = preparationProductionOrderCard(order);
  return <WorkerQueueCard backgroundColor={colors.surface} last={last} onPress={() => router.push({
    pathname: '/android-preparation/production-order', params: { id: order.order_id },
  } as unknown as Href)}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'precision_manufacturing' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.rowText}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{card.title}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{`${card.subtitle}\n${card.metrics}`}</NativeText></View>
  </WorkerQueueCard>;
}
function ProductionBatchRow({ batch, first, last, showOrder }: { batch: Batch; first: boolean; last: boolean; showOrder?: boolean }) {
  const colors = useMaterialColors(), card = preparationProductionBatchCard(batch, showOrder);
  return <WorkerQueueCard backgroundColor={colors.surface} first={first} last={last} onPress={() => router.push({
    pathname: '/android-preparation/production-batch', params: { id: batch.batch_id },
  } as unknown as Href)}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: 'precision_manufacturing' }} size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.rowText}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{card.title}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{`${card.subtitle}\n${card.metrics}`}</NativeText></View>
  </WorkerQueueCard>;
}

function ProductionRollRow({ roll, showMaterial, selecting, selected, first, last, onOpen, onSelect }: {
  roll: Roll; showMaterial?: boolean; selecting: boolean; selected: boolean; first: boolean; last: boolean;
  onOpen: () => void; onSelect: () => void;
}) {
  const colors = useMaterialColors(), card = preparationProductionRollCard(roll, showMaterial);
  return <WorkerQueueCard first={first} last={last} backgroundColor={selected ? colors.secondaryContainer : colors.surface}
    selected={selecting ? selected : undefined} onPress={selecting ? onSelect : onOpen}
    onLongPress={roll.receipt_name ? selecting ? undefined : onSelect : undefined}>
    <View accessible={false} style={[styles.icon, { backgroundColor: colors.surfaceContainerHighest }]}>
      <SymbolView name={{ android: selected ? 'check' : selecting ? 'radio_button_unchecked' : 'qr_code' }}
        size={20} tintColor={colors.onSurfaceVariant} />
    </View>
    <View style={styles.rowText}><NativeText style={[styles.headline, { color: colors.onSurface }]}>{card.title}</NativeText>
      <NativeText style={[styles.supporting, { color: colors.onSurfaceVariant }]}>{`${card.subtitle}\n${card.metrics}`}</NativeText></View>
  </WorkerQueueCard>;
}

function SelectionActions({ count, apply, cancel }: { count: number; apply: () => void; cancel: () => void }) {
  if (!count) return null;
  return <View style={styles.selectionActions}>
    <PreparationButton label={`${count} ta rulonga eslatma`} onPress={apply} />
    <PreparationButton label="Bekor qilish" onPress={cancel} />
  </View>;
}

function JournalHeader<T, S>({ state, journal }: { state: JournalState<T, S>; journal: PreparationJournal<T, S> }) {
  return <>{state.loading ? <ActivityIndicator /> : null}
    {state.error ? <><PreparationText>{state.error}</PreparationText>{state.error !== 'Akkaunt o‘zgargan. Sahifani qayta oching' &&
      <PreparationButton label="Qayta urinish" onPress={() => void journal.load()} />}</> : null}</>;
}
function JournalFooter<T, S>({ state, journal, emptyText }: { state: JournalState<T, S>; journal: PreparationJournal<T, S>; emptyText: string }) {
  const t = usePreparationText();
  return <>
    {!state.loading && !state.error && !state.items.length ? <PreparationText>{t(emptyText)}</PreparationText> : null}
    {state.has_more && state.error !== 'Akkaunt o‘zgargan. Sahifani qayta oching' ? <PreparationButton label="Yana yuklash" disabled={state.loading} onPress={() => void journal.load({ append: true })} /> : null}
  </>;
}

// @v2 PreparationProductionScreen
export function PreparationProductionScreen() {
  const { session } = usePreparationContext(), t = usePreparationText();
  const { view, query, status, state, journal, notes, accountChanged, selectView, changeQuery, changeStatus, loadMore, openRollNotes } =
    usePreparationProductionWorkspace(session);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), sheet = useNativeSheet();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(70);
  const [headerSize, setHeaderSize] = useState(70);
  const header = <View onLayout={event => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}><OrdersHeader search={query} searchPlaceholder={t(productionSearchPlaceholder)} onSearchChange={changeQuery}
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }}
      onProfile={() => router.navigate('/android-preparation/profile' as Href)} /></View>;
  return <><View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersWorkspace session={session} tabs={productionViews.map(tab => ({ ...tab, name: t(tab.name) }))}
      selected={view} onSelect={selectView} header={header} headerOffset={headerOffset} distributeTabs>
      {(id, pagerGesture) => <OrdersList active={id === view} pagerGesture={pagerGesture}
        headerOffset={headerOffset} headerHeight={headerHeight} topInset={headerSize + ORDERS_TAB_BAR_HEIGHT} passthrough={passthroughListItems}
        onRefresh={() => journal.load()} onEndReached={id === view ? loadMore : undefined}
        rows={id === view ? state.items : []} rowKey={productionRowKey}
        renderRow={(row, index) => {
          const first = index === 0, last = index === state.items.length - 1;
          if (row.kind === 'order') return <ProductionOrderRow order={row.order} last={last} />;
          if (row.kind === 'batch') return <ProductionBatchRow batch={row.batch} first={first} last={last} showOrder />;
          return <ProductionRollRow roll={row.roll} showMaterial first={first} last={last}
            selecting={notes.selected.size > 0} selected={notes.selected.has(row.roll.receipt_name)}
            onSelect={() => notes.toggle(row.roll)} onOpen={() => sheet.open(<PreparationDialogs>
              <RollPreview roll={notes.rollWithNotes(row.roll)} session={session} orderId={row.roll.order_id} />
            </PreparationDialogs>, { dismissible: true })} />;
        }} footer={id === view && state.loading ? <ActivityIndicator style={styles.status} /> : null}>
        {id === view && <DropdownFilter label={t('Holat')} selectedLabel={t(productionStatuses.find(item => item.value === status)?.label ?? 'Barchasi')}
          enabled={!accountChanged} backgroundColor={colors.surface} options={productionStatuses.map(item => ({ ...item, label: t(item.label) }))}
          onChange={changeStatus} last={!state.items.length} />}
        {id === view && state.error ? <View style={styles.status}><PreparationText>{state.error}</PreparationText>{!accountChanged &&
          <PreparationButton label="Qayta urinish" onPress={() => void journal.load()} />}</View> : null}
        {id === view && !state.loading && !state.error && !state.items.length ? <View style={styles.status}>
          <PreparationText>{t('Ishlab chiqarish yozuvlari topilmadi.')}</PreparationText></View> : null}
      </OrdersList>}
    </OrdersWorkspace>
    <SelectionActions count={notes.selected.size} apply={openRollNotes} cancel={notes.clearSelection} />
  </View><PreparationProductionNoteDialog editor={notes.editor} title={notes.title} description={notes.description} /></>;
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -16 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, marginStart: 16, paddingVertical: 6 },
  headline: { fontSize: 16, lineHeight: 24, includeFontPadding: false, fontWeight: '500' },
  supporting: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  status: { padding: 16 },
  selectionActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: 8 },
});

// @v2 PreparationProductionOrderScreen
export function PreparationProductionOrderScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext();
  const createJournal = useCallback((change: (state: JournalState<Batch, Order>) => void) =>
    createPreparationProductionOrderJournal(session, id, change), [session, id]);
  const { state, journal } = usePreparationJournal(createJournal);
  const t = usePreparationText(), order = state.summary;
  return <PreparationPage title={order ? `${t('Buyurtma')}: ${order.order_code || order.order_id}` : 'Buyurtma ishlab chiqarishi'}
    refreshing={state.loading && !!state.items.length} onRefresh={() => void journal.load()}>
    <JournalHeader state={state} journal={journal} />
    {order ? <PreparationRow title={order.order_title} subtitle={[order.customer_name, preparationProductionMetrics(order.roll_count, order.total_net_kg, order.total_length_m),
    ].filter(Boolean).join('\n')} /> : null}
    {order?.preparation_note.text ? <PreparationRow title={t('Buyurtma eslatmasi')} subtitle={order.preparation_note.text} /> : null}
    {state.items.length ? <View style={styles.list}>{state.items.map((batch, index) => <ProductionBatchRow key={batch.batch_id} batch={batch}
      first={index === 0} last={index === state.items.length - 1} />)}</View> : null}
    <JournalFooter state={state} journal={journal} emptyText="Bu buyurtma bo‘yicha ishlab chiqarish yozuvi yo‘q." />
  </PreparationPage>;
}

// @v2 RpsQrReprintSheet
function RollPreview({ roll, session, orderId }: { roll: Roll; session: Session; orderId: string }) {
  const t = usePreparationText(), dialogs = usePreparationDialogs();
  const [printing, setPrinting] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const active = useRef(true), busy = useRef(false), scope = useRef(sessionReadScope(session));
  useEffect(() => {
    active.current = true;
    const unregister = registerSessionResetHook(async () => { active.current = false; });
    return () => { active.current = false; unregister(); };
  }, []);
  const current = () => active.current && !!activeSessionToken(session) && scope.current === sessionReadScope(session);
  const selectDevice = () => selectPreparationDevice(dialogs, current);
  const reprint = async () => {
    if (busy.current || !current()) return;
    busy.current = true; setPrinting(true); setNotice(null);
    try {
      const warning = await reprintPreparationRollWithPrinter(session, roll, orderId, { isCurrent: current, selectDevice });
      if (active.current) setNotice(warning ?? 'Mavjud QR qayta chop etildi');
    } catch (error) {
      if (active.current && !(error instanceof PreparationReprintCancelled)) setNotice(error instanceof Error ? error.message : String(error));
    } finally { busy.current = false; if (active.current) setPrinting(false); }
  };
  const image = useMemo(() => { try { const qr = qrFactory(0, 'M'); qr.addData(roll.epc); qr.make(); return qr.createDataURL(5, 20); } catch { return null; } }, [roll.epc]);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    <PreparationText title>{t('Chop etilgan QR')}</PreparationText><PreparationText>{roll.item_name || roll.item_code}</PreparationText>
    {image ? <Image source={{ uri: image }} style={{ width: 208, height: 208, alignSelf: 'center', backgroundColor: '#fff' }} contentFit="contain" /> : null}
    <PreparationText>{roll.epc}</PreparationText>
    {roll.batch_note?.text ? <PreparationText>{`${t('Batch eslatmasi')}: ${roll.batch_note.text}`}</PreparationText> : null}
    {roll.roll_note?.text ? <PreparationText>{`${t('Rulon eslatmasi')}: ${roll.roll_note.text}`}</PreparationText> : null}
    {preparationProductionRecipeLines(roll.preparation_formula).map((line, index) => <PreparationText key={index}>{t(line)}</PreparationText>)}
    {notice ? <PreparationText>{t(notice)}</PreparationText> : null}
    <PreparationButton label="Qayta chop etish" disabled={printing || !orderId} onPress={() => void reprint()} id="preparation-roll-reprint" />
  </ScrollView>;
}

// @v2 PreparationProductionBatchScreen
export function PreparationProductionBatchScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext();
  const createJournal = useCallback((change: (state: JournalState<Roll, Batch>) => void) =>
    createPreparationProductionBatchJournal(session, id, change), [session, id]);
  const { state, journal } = usePreparationJournal(createJournal);
  const sheet = useNativeSheet(), t = usePreparationText(), batch = state.summary;
  const notes = usePreparationOutputNotes(session, () => { void journal.load(); });
  const batchNote = batch && notes.latest('batch', batch.batch_id, batch.batch_note);
  return <><PreparationPage title={batch?.item_name || batch?.item_code || 'Ishlab chiqarish'} refreshing={state.loading && !!state.items.length}
    onRefresh={() => void journal.load()} footer={<SelectionActions count={notes.selected.size}
      apply={() => notes.openSelection(state.items)} cancel={notes.clearSelection} />}>
    <JournalHeader state={state} journal={journal} />
    {batch ? <>
      <PreparationRow title={t(batch.active ? 'Davom etmoqda' : 'Yakunlangan')}
        subtitle={`${batch.warehouse}\n${t('Boshlangan')}: ${preparationProductionDate(batch.started_at)}${batch.ended_at ? `\n${t('Tugagan')}: ${preparationProductionDate(batch.ended_at)}` : ''}\n${preparationProductionMetrics(batch.roll_count, batch.total_net_kg, batch.total_length_m)}`} />
      <View>{preparationProductionRecipeLines(batch.preparation_formula).map((line, index) => <PreparationText key={index}>{t(line)}</PreparationText>)}</View>
      {batch.batch_id.startsWith('batch:') ? <PreparationRow title={t('Batch eslatmasi')} subtitle={batchNote?.text}
        trailing={<WorkerIconButton icon="edit" label={t('Batchga eslatma')} onPress={() => notes.openBatch(batch.batch_id, batchNote)} />} /> : null}
    </> : null}
    {state.items.map((roll, index) => <ProductionRollRow key={roll.receipt_name || roll.epc} roll={roll}
      first={index === 0} last={index === state.items.length - 1} selecting={notes.selected.size > 0} selected={notes.selected.has(roll.receipt_name)}
      onSelect={() => notes.toggle(roll)} onOpen={() => sheet.open(<PreparationDialogs>
        <RollPreview roll={notes.rollWithNotes(roll)} session={session} orderId={roll.order_id || batch?.order_id || ''} />
      </PreparationDialogs>, { dismissible: true })} />)}
    <JournalFooter state={state} journal={journal} emptyText="Hali rulon kirim qilinmagan." />
  </PreparationPage><PreparationProductionNoteDialog editor={notes.editor} title={notes.title} description={notes.description} /></>;
}
