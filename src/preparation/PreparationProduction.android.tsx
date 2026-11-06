import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import qrFactory from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { useNativeSheet } from '../nativeSheet';
import { sessionReadScope } from '../sessionReadScope';
import { usePreparationContext } from './PreparationContext.android';
import { type JournalState, PreparationJournal } from './preparationJournal';
import { createPreparationProductionBatchJournal, createPreparationProductionOrderJournal, createPreparationProductionOrdersJournal } from './preparationJournalFactory';
import { preparationProductionBatchCard, preparationProductionDate, preparationProductionMetrics, preparationProductionOrderCard,
  preparationProductionRecipeLines, preparationProductionRollCard } from './preparationProductionPresentation';
import { selectPreparationDevice } from './preparationDevicePicker.android';
import { reprintPreparationRollWithPrinter } from './preparationPrinter';
import { PreparationReprintCancelled } from './preparationReprint';
import { PreparationButton, PreparationDialogs, PreparationField, PreparationPage, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';
import type { preparationProductionBatchFromJson, preparationProductionOrderFromJson, preparationProductionRollFromJson } from './preparationProductionModel';

type Order = ReturnType<typeof preparationProductionOrderFromJson>;
type Batch = ReturnType<typeof preparationProductionBatchFromJson>;
type Roll = ReturnType<typeof preparationProductionRollFromJson>;
function ProductionStatusOptions({ choose }: { choose: (value: string) => void }) {
  const t = usePreparationText();
  return <>{[{ label: 'Barchasi', value: 'all' }, { label: 'Davom etmoqda', value: 'active' }, { label: 'Yakunlangan', value: 'completed' }]
    .map(option => <PreparationRow key={option.value} title={t(option.label)} onPress={() => choose(option.value)} />)}</>;
}
const empty = <T, S,>(): JournalState<T, S> => ({ items: [], loading: true, error: null, has_more: false, next_offset: null, summary: null });

function useJournal<T, S>(factory: (change: (state: JournalState<T, S>) => void) => PreparationJournal<T, S>) {
  const [state, setState] = useState<JournalState<T, S>>(empty);
  const group = useMemo(() => {
    const journal = factory(next => setState({ ...next }));
    let mounts = 0;
    return { journal, mount() {
      mounts++; journal.start();
      return () => { mounts--; queueMicrotask(() => { if (!mounts) journal.dispose(); }); };
    } };
  }, [factory]);
  const journal = group.journal;
  useEffect(() => group.mount(), [group]);
  useEffect(() => registerSessionResetHook(async () => { journal.invalidate(); }), [journal]);
  useFocusEffect(useCallback(() => { journal.setVisible(true); return () => journal.setVisible(false); }, [journal]));
  useEffect(() => {
    journal.setResumed(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => journal.setResumed(state === 'active'));
    return () => listener.remove();
  }, [journal]);
  return { state, journal };
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
  const [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [expanded, setExpanded] = useState(false);
  const filters = useRef({ query: '', status: 'all' });
  const createJournal = useCallback((change: (state: JournalState<Order>) => void) =>
    createPreparationProductionOrdersJournal(session, () => filters.current, change), [session]);
  const { state, journal } = useJournal(createJournal);
  const firstFilter = useRef(true), searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (firstFilter.current) { firstFilter.current = false; return; }
    searchTimer.current = setTimeout(() => { searchTimer.current = null; filters.current = { ...filters.current, query: query.trim() }; void journal.load(); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = null; };
  }, [query, journal]);
  const chooseStatus = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = null;
    setStatus(value); setExpanded(false); filters.current = { query: query.trim(), status: value }; void journal.load();
  };
  const accountChanged = state.error === 'Akkaunt o‘zgargan. Sahifani qayta oching';
  return <PreparationPage title="Ishlab chiqarish" drawer refreshing={state.loading && !!state.items.length} onRefresh={() => void journal.load()}>
    <PreparationField label="Buyurtma, homashyo yoki formula" onChange={setQuery} enabled={!accountChanged} />
    <PreparationRow title={t('Holat')} subtitle={t(status === 'active' ? 'Davom etmoqda' : status === 'completed' ? 'Yakunlangan' : 'Barchasi')}
      disabled={accountChanged} onPress={() => setExpanded(value => !value)} />
    {expanded && !accountChanged && <ProductionStatusOptions choose={chooseStatus} />}
    <JournalHeader state={state} journal={journal} />
    {state.items.map(order => { const card = preparationProductionOrderCard(order); return <PreparationRow key={order.order_id} title={card.title}
      subtitle={`${card.subtitle}\n${card.metrics}`} onPress={() => router.push({ pathname: '/android-preparation/production-order', params: { id: order.order_id } } as unknown as Href)} />; })}
    <JournalFooter state={state} journal={journal} emptyText="Hali ishlab chiqarish yozuvlari yo‘q." />
  </PreparationPage>;
}

// @v2 PreparationProductionOrderScreen
export function PreparationProductionOrderScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext();
  const createJournal = useCallback((change: (state: JournalState<Batch, Order>) => void) =>
    createPreparationProductionOrderJournal(session, id, change), [session, id]);
  const { state, journal } = useJournal(createJournal);
  const t = usePreparationText(), order = state.summary;
  return <PreparationPage title={order ? `${t('Buyurtma')}: ${order.order_code || order.order_id}` : 'Buyurtma ishlab chiqarishi'}
    refreshing={state.loading && !!state.items.length} onRefresh={() => void journal.load()}>
    <JournalHeader state={state} journal={journal} />
    {order ? <PreparationRow title={order.order_title} subtitle={[order.customer_name, preparationProductionMetrics(order.roll_count, order.total_net_kg, order.total_length_m)].filter(Boolean).join('\n')} /> : null}
    {state.items.map(batch => { const card = preparationProductionBatchCard(batch); return <PreparationRow key={batch.batch_id} title={card.title}
      subtitle={`${card.subtitle}\n${card.metrics}`} onPress={() => router.push({ pathname: '/android-preparation/production-batch', params: { id: batch.batch_id } } as unknown as Href)} />; })}
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
  const { state, journal } = useJournal(createJournal);
  const sheet = useNativeSheet(), t = usePreparationText(), batch = state.summary;
  return <PreparationPage title={batch?.item_name || batch?.item_code || 'Ishlab chiqarish'} refreshing={state.loading && !!state.items.length} onRefresh={() => void journal.load()}>
    <JournalHeader state={state} journal={journal} />
    {batch ? <>
      <PreparationRow title={t(batch.active ? 'Davom etmoqda' : 'Yakunlangan')}
        subtitle={`${batch.warehouse}\n${t('Boshlangan')}: ${preparationProductionDate(batch.started_at)}${batch.ended_at ? `\n${t('Tugagan')}: ${preparationProductionDate(batch.ended_at)}` : ''}\n${preparationProductionMetrics(batch.roll_count, batch.total_net_kg, batch.total_length_m)}`} />
      <View>{preparationProductionRecipeLines(batch.preparation_formula).map((line, index) => <PreparationText key={index}>{t(line)}</PreparationText>)}</View>
    </> : null}
    {state.items.map(roll => { const card = preparationProductionRollCard(roll); return <PreparationRow key={roll.epc} title={card.title}
      subtitle={`${card.subtitle}\n${card.metrics}`} onPress={() => sheet.open(<PreparationDialogs><RollPreview roll={roll} session={session} orderId={batch?.order_id ?? ''} /></PreparationDialogs>, { dismissible: true })} />; })}
    <JournalFooter state={state} journal={journal} emptyText="Hali rulon kirim qilinmagan." />
  </PreparationPage>;
}
