import { Button, Host, HStack, Image as SystemImage, List, Menu, ProgressView, RNHostView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityAddTraits, accessibilityLabel, disabled, frame, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import qrFactory from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, usePreparationText } from './PreparationUI';
import { openPreparationRoute } from './PreparationRoutes';
import { type JournalState } from './preparationJournal';
import { createPreparationProductionBatchJournal, createPreparationProductionOrderJournal, productionRowKey, productionViews } from './preparationJournalFactory';
import { preparationProductionBatchCard, preparationProductionDate, preparationProductionMetrics, preparationProductionOrderCard,
  preparationProductionRecipeLines, preparationProductionRollCard } from './preparationProductionPresentation';
import type { preparationProductionBatchFromJson, preparationProductionOrderFromJson, preparationProductionRollFromJson } from './preparationProductionModel';
import { reprintPreparationRollWithPrinter, type PreparationDeviceSelection } from './preparationPrinter';
import { PreparationReprintCancelled } from './preparationReprint';
import { PreparationPrinterPicker } from './PreparationPrinterPicker';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { OrdersList } from '../shared/orders/OrdersList';
import { PreparationProductionNoteDialog } from './PreparationProductionNoteDialog';
import { usePreparationOutputNotes } from './usePreparationOutputNotes';
import { productionSearchPlaceholder, productionStatuses, usePreparationJournal, usePreparationProductionWorkspace } from './usePreparationProductionWorkspace';

type Order = ReturnType<typeof preparationProductionOrderFromJson>;
type Batch = ReturnType<typeof preparationProductionBatchFromJson>;
type Roll = ReturnType<typeof preparationProductionRollFromJson>;
function ProductionCard({ card }: { card: { title: string; subtitle: string; metrics: string } }) {
  return <VStack alignment="leading"><Text>{card.title}</Text><Text>{card.subtitle}</Text><Text>{card.metrics}</Text></VStack>;
}

function ProductionRollRow({ roll, showMaterial, selecting, selected, onOpen, onSelect }: {
  roll: Roll; showMaterial?: boolean; selecting: boolean; selected: boolean; onOpen: () => void; onSelect: () => void;
}) {
  const t = usePreparationText();
  const card = preparationProductionRollCard(roll, showMaterial);
  return <Button onPress={selecting ? onSelect : onOpen} modifiers={[
    ...(selected ? [accessibilityAddTraits(['isSelected'])] : []),
    accessibilityLabel([card.title, card.subtitle, card.metrics, selected ? t('Tanlangan') : ''].filter(Boolean).join(', ')),
    ...(roll.receipt_name && !selecting ? [onLongPressGesture(onSelect, 0.5)] : []),
  ]}><HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><ProductionCard card={card} />
    {selecting && <><Spacer /><SystemImage systemName={selected ? 'checkmark.circle.fill' : 'circle'} size={20} /></>}
  </HStack></Button>;
}

function SelectionActions({ count, apply, cancel }: { count: number; apply: () => void; cancel: () => void }) {
  const t = usePreparationText(), insets = useSafeAreaInsets();
  if (!count) return null;
  return <View style={{ paddingBottom: insets.bottom, paddingHorizontal: 16 }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}><HStack spacing={10}>
      <Button label={t(`${count} ta rulonga eslatma`)} systemImage="square.and.pencil" onPress={apply} />
      <Button label={t('Bekor qilish')} onPress={cancel} />
    </HStack></Host>
  </View>;
}
function JournalHeader<T, S>({ state, reload }: { state: JournalState<T, S>; reload: () => void }) {
  const t = usePreparationText();
  return <>{state.loading && <ProgressView />}{!!state.error && <Section><Text>{state.error}</Text>
    {state.error !== 'Akkaunt o‘zgargan. Sahifani qayta oching' && <Button label={t('Qayta urinish')} onPress={reload} />}</Section>}</>;
}
function JournalFooter<T, S>({ state, more, empty }: { state: JournalState<T, S>; more: () => void; empty: string }) {
  const t = usePreparationText();
  return <>
    {!state.loading && !state.error && !state.items.length && <Section><Text>{t(empty)}</Text></Section>}
    {state.has_more && state.error !== 'Akkaunt o‘zgargan. Sahifani qayta oching' && <Section><Button label={t('Yana yuklash')} modifiers={[disabled(state.loading)]} onPress={more} /></Section>}</>;
}
function Recipe({ recipe }: { recipe: Readonly<Record<string, unknown>> | null }) {
  const t = usePreparationText();
  return <VStack alignment="leading">{preparationProductionRecipeLines(recipe).map((line, index) => <Text key={index}>{t(line)}</Text>)}</VStack>;
}

// @v2 RpsQrReprintSheet
function RollSheet({ roll, session, orderId }: { roll: Roll; session: Session; orderId: string }) {
  const t = usePreparationText(), picker = useNativeSheet();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const valid = useRef(true), pending = useRef<((value: PreparationDeviceSelection | null) => void) | null>(null);
  useEffect(() => {
    valid.current = true;
    const unregister = registerSessionResetHook(async () => { valid.current = false; pending.current?.(null); });
    return () => { unregister(); valid.current = false; pending.current?.(null); };
  }, []);
  const selectDevice = () => new Promise<PreparationDeviceSelection | null>(resolve => {
    let settled = false;
    const finish = (value: PreparationDeviceSelection | null) => {
      if (settled) return;
      settled = true; pending.current = null; resolve(value);
    };
    pending.current = finish;
    picker.open(<PreparationPrinterPicker select={value => { finish(value); picker.close(); }} />,
      { dismissible: true, onDismiss: () => finish(null) });
  });
  const reprint = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const warning = await reprintPreparationRollWithPrinter(session, roll, orderId,
        { isCurrent: () => valid.current && !!activeSessionToken(session), selectDevice });
      if (valid.current) Alert.alert(t(warning ?? 'Mavjud QR qayta chop etildi'));
    } catch (reason) {
      if (valid.current && !(reason instanceof PreparationReprintCancelled)) setError(reason instanceof Error ? reason.message : String(reason));
    } finally { if (valid.current) setBusy(false); }
  };
  const image = useMemo(() => {
    try { const qr = qrFactory(0, 'M'); qr.addData(roll.epc); qr.make(); return qr.createDataURL(5, 20); }
    catch { return ''; }
  }, [roll.epc]);
  return <Host style={{ minHeight: 450 }}><VStack spacing={12}><Text>{t('Chop etilgan QR')}</Text>
    <Text>{roll.item_name || roll.item_code}</Text>
    {!!image && <RNHostView matchContents><Image source={{ uri: image }} style={{ width: 200, height: 200, backgroundColor: 'white' }}
      contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} /></RNHostView>}
    <Text>{roll.epc}</Text><List>
      {!!roll.batch_note?.text && <Section title={t('Batch eslatmasi')}><Text>{roll.batch_note.text}</Text></Section>}
      {!!roll.roll_note?.text && <Section title={t('Rulon eslatmasi')}><Text>{roll.roll_note.text}</Text></Section>}
      <Section><Recipe recipe={roll.preparation_formula} /></Section>
    </List>
    {!!error && <Text>{error}</Text>}
    <Button label={t('Qayta chop etish')} modifiers={[disabled(busy || !orderId)]} onPress={() => { void reprint(); }} />
  </VStack></Host>;
}

// @v2 PreparationProductionScreen
export function PreparationProduction() {
  const { session } = usePreparationContext(), t = usePreparationText();
  const { view, query, status, state, journal, notes, accountChanged, selectView, changeQuery, changeStatus, loadMore, openRollNotes } =
    usePreparationProductionWorkspace(session);
  const sheet = useNativeSheet(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(70);
  const label = t(productionStatuses.find(item => item.value === status)?.label ?? 'Barchasi');
  return <><View style={{ flex: 1 }}><OrdersWorkspace session={session} title={t('Ishlab chiqarish')} tabPickerStyle="segmented" tabPickerLabel={t('Ko‘rinish')}
    tabs={productionViews.map(tab => ({ ...tab, name: t(tab.name) }))} selected={view} onSelect={selectView}
    search={query} searchPlaceholder={t(productionSearchPlaceholder)} onSearchChange={changeQuery}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/ios-preparation' as Href); }}
    onProfile={() => router.navigate('/ios-preparation/profile' as Href)}>
    {(id, pagerGesture, modePicker) => <OrdersList active={id === view} pagerGesture={pagerGesture}
      headerOffset={headerOffset} headerHeight={headerHeight} topInset={0} onRefresh={() => journal.load()}
      rows={state.items} rowKey={productionRowKey} renderRow={row => {
        if (row.kind === 'order') return <Button onPress={() => openPreparationRoute('production-order', { id: row.order.order_id })}>
          <ProductionCard card={preparationProductionOrderCard(row.order)} /></Button>;
        if (row.kind === 'batch') return <Button onPress={() => openPreparationRoute('production-batch', { id: row.batch.batch_id })}>
          <ProductionCard card={preparationProductionBatchCard(row.batch, true)} /></Button>;
        return <ProductionRollRow roll={row.roll} showMaterial selecting={notes.selected.size > 0} selected={notes.selected.has(row.roll.receipt_name)}
          onSelect={() => notes.toggle(row.roll)} onOpen={() => sheet.open(<RollSheet roll={notes.rollWithNotes(row.roll)} session={session}
            orderId={row.roll.order_id} />, { compact: true, dismissible: true })} />;
      }} footer={<JournalFooter state={state} empty="Ishlab chiqarish yozuvlari topilmadi." more={loadMore} />}>
      <Section>{modePicker}<Menu label={`${t('Holat')}: ${label}`} modifiers={[disabled(accountChanged)]}>
        {productionStatuses.map(item => <Button key={item.value} label={t(item.label)} onPress={() => changeStatus(item.value)} />)}
      </Menu></Section>
      <JournalHeader state={state} reload={() => { void journal.load(); }} />
    </OrdersList>}
  </OrdersWorkspace><SelectionActions count={notes.selected.size} apply={openRollNotes} cancel={notes.clearSelection} /></View>
    <PreparationProductionNoteDialog editor={notes.editor} title={notes.title} description={notes.description} /></>;
}

// @v2 PreparationProductionOrderScreen
export function PreparationProductionOrder() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext(), t = usePreparationText();
  const make = useCallback((changed: (state: JournalState<Batch, Order>) => void) => createPreparationProductionOrderJournal(session, id, changed), [session, id]);
  const { state, journal } = usePreparationJournal(make);
  return <><Stack.Screen options={{ title: state.summary ? `${t('Buyurtma')}: ${state.summary.order_code || state.summary.order_id}` : t('Buyurtma ishlab chiqarishi') }} />
    <PreparationList refresh={() => journal.load()}>
      <JournalHeader state={state} reload={() => { void journal.load(); }} />
      {state.summary && <Section><Text>{state.summary.order_title}</Text><Text>{state.summary.customer_name}</Text>
        <Text>{preparationProductionMetrics(state.summary.roll_count, state.summary.total_net_kg, state.summary.total_length_m)}</Text>
        {!!state.summary.preparation_note.text && <Text>{t('Buyurtma eslatmasi')}: {state.summary.preparation_note.text}</Text>}</Section>}
      <Section>{state.items.map(batch => { const card = preparationProductionBatchCard(batch); return <Button key={batch.batch_id} onPress={() => openPreparationRoute('production-batch', { id: batch.batch_id })}>
        <VStack alignment="leading"><Text>{card.title}</Text><Text>{card.subtitle}</Text><Text>{card.metrics}</Text></VStack>
      </Button>; })}</Section>
      <JournalFooter state={state} empty="Bu buyurtma bo‘yicha ishlab chiqarish yozuvi yo‘q." more={() => { void journal.load({ append: true }); }} />
    </PreparationList></>;
}

// @v2 PreparationProductionBatchScreen
export function PreparationProductionBatch() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const make = useCallback((changed: (state: JournalState<Roll, Batch>) => void) => createPreparationProductionBatchJournal(session, id, changed), [session, id]);
  const { state, journal } = usePreparationJournal(make);
  const notes = usePreparationOutputNotes(session, () => { void journal.load(); });
  const batch = state.summary;
  const batchNote = batch && notes.latest('batch', batch.batch_id, batch.batch_note);
  return <><Stack.Screen options={{ title: state.summary ? state.summary.item_name || state.summary.item_code : t('Ishlab chiqarish') }} />
    <View style={{ flex: 1 }}><PreparationList refresh={() => journal.load()}>
      <JournalHeader state={state} reload={() => { void journal.load(); }} />
      {batch && <Section><Text>{t(batch.active ? 'Davom etmoqda' : 'Yakunlangan')}</Text>
        <Text>{batch.warehouse}</Text><Text>{t('Boshlangan')}: {preparationProductionDate(batch.started_at)}</Text>
        {!!batch.ended_at && <Text>{t('Tugagan')}: {preparationProductionDate(batch.ended_at)}</Text>}
        <Text>{preparationProductionMetrics(batch.roll_count, batch.total_net_kg, batch.total_length_m)}</Text>
        <Recipe recipe={batch.preparation_formula} /></Section>}
      {batch?.batch_id.startsWith('batch:') && <Section title={t('Batch eslatmasi')}>
        {!!batchNote?.text && <Text>{batchNote.text}</Text>}
        <Button label={t('Batchga eslatma')} systemImage="pencil" onPress={() => notes.openBatch(batch.batch_id, batchNote)} />
      </Section>}
      <Section>{state.items.map(roll => <ProductionRollRow key={roll.receipt_name || roll.epc} roll={roll}
        selecting={notes.selected.size > 0} selected={notes.selected.has(roll.receipt_name)} onSelect={() => notes.toggle(roll)}
        onOpen={() => sheet.open(<RollSheet roll={notes.rollWithNotes(roll)} session={session} orderId={roll.order_id || batch?.order_id || ''} />,
          { compact: true, dismissible: true })} />)}</Section>
      <JournalFooter state={state} empty="Hali rulon kirim qilinmagan." more={() => { void journal.load({ append: true }); }} />
    </PreparationList><SelectionActions count={notes.selected.size}
      apply={() => notes.openSelection(state.items)} cancel={notes.clearSelection} /></View>
    <PreparationProductionNoteDialog editor={notes.editor} title={notes.title} description={notes.description} /></>;
}
