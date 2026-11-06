import { Button, Host, List, ProgressView, RNHostView, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import qrFactory from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, usePreparationText } from './PreparationUI';
import { openPreparationRoute } from './PreparationRoutes';
import { PreparationJournal, type JournalState } from './preparationJournal';
import { createPreparationProductionBatchJournal, createPreparationProductionOrderJournal, createPreparationProductionOrdersJournal } from './preparationJournalFactory';
import { preparationProductionBatchCard, preparationProductionDate, preparationProductionMetrics, preparationProductionOrderCard,
  preparationProductionRecipeLines, preparationProductionRollCard } from './preparationProductionPresentation';
import type { preparationProductionBatchFromJson, preparationProductionOrderFromJson, preparationProductionRollFromJson } from './preparationProductionModel';
import { reprintPreparationRollWithPrinter, type PreparationDeviceSelection } from './preparationPrinter';
import { PreparationReprintCancelled } from './preparationReprint';
import { PreparationPrinterPicker } from './PreparationPrinterPicker';

type Order = ReturnType<typeof preparationProductionOrderFromJson>;
type Batch = ReturnType<typeof preparationProductionBatchFromJson>;
type Roll = ReturnType<typeof preparationProductionRollFromJson>;
function ProductionStatusOptions({ labels, choose }: { labels: Record<string, string>; choose: (value: string) => void }) {
  const t = usePreparationText();
  return <>{Object.entries(labels).map(([key, label]) => <Button key={key} label={t(label)} onPress={() => choose(key)} />)}</>;
}
function useJournal<T, S>(make: (changed: (state: JournalState<T, S>) => void) => PreparationJournal<T, S>) {
  const [state, setState] = useState<JournalState<T, S>>({ items: [], loading: true, error: null, has_more: false, next_offset: null, summary: null });
  const current = useRef<PreparationJournal<T, S> | null>(null), visible = useRef(false);
  useEffect(() => {
    const journal = make(setState); current.current = journal;
    const unregister = registerSessionResetHook(async () => { journal.sessionChanged(true); });
    journal.setVisible(visible.current); journal.setResumed(AppState.currentState === 'active'); journal.start();
    const subscription = AppState.addEventListener('change', value => journal.setResumed(value === 'active'));
    return () => { unregister(); subscription.remove(); current.current = null; journal.dispose(); };
  }, [make]);
  useFocusEffect(useCallback(() => { visible.current = true; current.current?.setVisible(true);
    return () => { visible.current = false; current.current?.setVisible(false); }; }, []));
  return { state, current };
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
    <Text>{roll.epc}</Text><List><Recipe recipe={roll.preparation_formula} /></List>
    {!!error && <Text>{error}</Text>}
    <Button label={t('Qayta chop etish')} modifiers={[disabled(busy)]} onPress={() => { void reprint(); }} />
  </VStack></Host>;
}

// @v2 PreparationProductionScreen
export function PreparationProduction() {
  const { session } = usePreparationContext(), t = usePreparationText();
  const filters = useRef({ query: '', status: 'all' }), searchText = useRef(''), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState('all'), [expanded, setExpanded] = useState(false);
  const make = useCallback((changed: (state: JournalState<Order>) => void) => createPreparationProductionOrdersJournal(session, () => filters.current, changed), [session]);
  const { state, current } = useJournal(make);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const search = (value: string) => {
    searchText.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { filters.current.query = value.trim(); void current.current?.load(); }, 350);
  };
  const changeStatus = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    setStatus(value); setExpanded(false); filters.current.status = value; filters.current.query = searchText.current.trim(); void current.current?.load();
  };
  const labels: Record<string, string> = { all: 'Barchasi', active: 'Davom etmoqda', completed: 'Yakunlangan' };
  const accountChanged = state.error === 'Akkaunt o‘zgargan. Sahifani qayta oching';
  return <><Stack.Screen options={{ title: t('Ishlab chiqarish') }} /><PreparationList refresh={async () => { await current.current?.load(); }}>
    <Section><TextField placeholder={t('Buyurtma, homashyo yoki formula')} modifiers={[disabled(accountChanged)]} onTextChange={search} />
      <Button label={`${t('Holat')}: ${t(labels[status])}`} modifiers={[disabled(accountChanged)]} onPress={() => setExpanded(value => !value)} />
      {expanded && !accountChanged && <ProductionStatusOptions labels={labels} choose={changeStatus} />}</Section>
    <JournalHeader state={state} reload={() => { void current.current?.load(); }} />
    <Section>{state.items.map(order => { const card = preparationProductionOrderCard(order); return <Button key={order.order_id} onPress={() => openPreparationRoute('production-order', { id: order.order_id })}>
      <VStack alignment="leading"><Text>{card.title}</Text><Text>{card.subtitle}</Text><Text>{card.metrics}</Text></VStack>
    </Button>; })}</Section>
    <JournalFooter state={state} empty="Hali ishlab chiqarish yozuvlari yo‘q." more={() => { void current.current?.load({ append: true }); }} />
  </PreparationList></>;
}

// @v2 PreparationProductionOrderScreen
export function PreparationProductionOrder() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext(), t = usePreparationText();
  const make = useCallback((changed: (state: JournalState<Batch, Order>) => void) => createPreparationProductionOrderJournal(session, id, changed), [session, id]);
  const { state, current } = useJournal(make);
  return <><Stack.Screen options={{ title: state.summary ? `${t('Buyurtma')}: ${state.summary.order_code || state.summary.order_id}` : t('Buyurtma ishlab chiqarishi') }} />
    <PreparationList refresh={async () => { await current.current?.load(); }}>
      <JournalHeader state={state} reload={() => { void current.current?.load(); }} />
      {state.summary && <Section><Text>{state.summary.order_title}</Text><Text>{state.summary.customer_name}</Text>
        <Text>{preparationProductionMetrics(state.summary.roll_count, state.summary.total_net_kg, state.summary.total_length_m)}</Text></Section>}
      <Section>{state.items.map(batch => { const card = preparationProductionBatchCard(batch); return <Button key={batch.batch_id} onPress={() => openPreparationRoute('production-batch', { id: batch.batch_id })}>
        <VStack alignment="leading"><Text>{card.title}</Text><Text>{card.subtitle}</Text><Text>{card.metrics}</Text></VStack>
      </Button>; })}</Section>
      <JournalFooter state={state} empty="Bu buyurtma bo‘yicha ishlab chiqarish yozuvi yo‘q." more={() => { void current.current?.load({ append: true }); }} />
    </PreparationList></>;
}

// @v2 PreparationProductionBatchScreen
export function PreparationProductionBatch() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const make = useCallback((changed: (state: JournalState<Roll, Batch>) => void) => createPreparationProductionBatchJournal(session, id, changed), [session, id]);
  const { state, current } = useJournal(make);
  return <><Stack.Screen options={{ title: state.summary ? state.summary.item_name || state.summary.item_code : t('Ishlab chiqarish') }} />
    <PreparationList refresh={async () => { await current.current?.load(); }}>
      <JournalHeader state={state} reload={() => { void current.current?.load(); }} />
      {state.summary && <Section><Text>{t(state.summary.active ? 'Davom etmoqda' : 'Yakunlangan')}</Text>
        <Text>{state.summary.warehouse}</Text><Text>{t('Boshlangan')}: {preparationProductionDate(state.summary.started_at)}</Text>
        {!!state.summary.ended_at && <Text>{t('Tugagan')}: {preparationProductionDate(state.summary.ended_at)}</Text>}
        <Text>{preparationProductionMetrics(state.summary.roll_count, state.summary.total_net_kg, state.summary.total_length_m)}</Text>
        <Recipe recipe={state.summary.preparation_formula} /></Section>}
      <Section>{state.items.map(roll => { const card = preparationProductionRollCard(roll); return <Button key={roll.epc} onPress={() => sheet.open(<RollSheet roll={roll} session={session}
        orderId={state.summary?.order_id ?? ''} />, { compact: true, dismissible: true })}>
        <VStack alignment="leading"><Text>{card.title}</Text><Text>{card.subtitle}</Text><Text>{card.metrics}</Text></VStack>
      </Button>; })}</Section>
      <JournalFooter state={state} empty="Hali rulon kirim qilinmagan." more={() => { void current.current?.load({ append: true }); }} />
    </PreparationList></>;
}
