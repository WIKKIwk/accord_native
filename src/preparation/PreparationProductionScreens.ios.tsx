import { Button, Host, List, Menu, RNHostView, Section, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import qrFactory from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationList, PreparationStatus, usePreparationText } from './PreparationUI';
import { preparationJournalDate } from './PreparationDate';
import { openPreparationRoute } from './PreparationRoutes';
import { PreparationJournal, type JournalState } from './preparationJournal';
import { createPreparationProductionBatchJournal, createPreparationProductionOrderJournal, createPreparationProductionOrdersJournal } from './preparationJournalFactory';
import { preparationDisplay } from './preparationModel';
import type { preparationProductionBatchFromJson, preparationProductionOrderFromJson, preparationProductionRollFromJson } from './preparationProductionModel';

type Order = ReturnType<typeof preparationProductionOrderFromJson>;
type Batch = ReturnType<typeof preparationProductionBatchFromJson>;
type Roll = ReturnType<typeof preparationProductionRollFromJson>;
function useJournal<T, S>(make: (changed: (state: JournalState<T, S>) => void) => PreparationJournal<T, S>) {
  const [state, setState] = useState<JournalState<T, S>>({ items: [], loading: true, error: null, has_more: false, next_offset: null, summary: null });
  const current = useRef<PreparationJournal<T, S> | null>(null), visible = useRef(false);
  useEffect(() => {
    const journal = make(setState); current.current = journal;
    journal.setVisible(visible.current); journal.setResumed(AppState.currentState === 'active'); journal.start();
    const subscription = AppState.addEventListener('change', value => journal.setResumed(value === 'active'));
    return () => { subscription.remove(); current.current = null; journal.dispose(); };
  }, [make]);
  useFocusEffect(useCallback(() => { visible.current = true; current.current?.setVisible(true);
    return () => { visible.current = false; current.current?.setVisible(false); }; }, []));
  return { state, current };
}
function JournalFooter<T, S>({ state, more, reload, empty }: { state: JournalState<T, S>; more: () => void; reload: () => void; empty: string }) {
  const t = usePreparationText();
  return <><PreparationStatus loading={state.loading} error={state.error} retry={reload} />
    {!state.loading && !state.error && !state.items.length && <Section><Text>{t(empty)}</Text></Section>}
    {state.has_more && <Section><Button label={t('Yana yuklash')} modifiers={[disabled(state.loading)]} onPress={more} /></Section>}</>;
}
function Recipe({ recipe }: { recipe: Readonly<Record<string, unknown>> | null }) {
  const t = usePreparationText();
  if (!recipe || !Object.keys(recipe).length) return <Text>{t('Formula qayd etilmagan')}</Text>;
  const formulas = Array.isArray(recipe.formulas) ? recipe.formulas : [];
  return <VStack alignment="leading"><Text>{t(`Shnek formulasi: ${String(recipe.variant_name ?? '—')}`)}</Text>
    {recipe.variant_code != null && <Text>{t(`Formula kodi: ${String(recipe.variant_code)}`)}</Text>}
    <Text>{t(`Saqlangan tarkib • ${preparationJournalDate(String(recipe.captured_at ?? ''))}`)}</Text>
    {formulas.map((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const item = value as Record<string, unknown>, lines = Array.isArray(item.lines) ? item.lines : [];
      return <VStack key={index} alignment="leading"><Text>{t(`Shnek ${String(item.name ?? '')} • ${String(item.share_percent ?? '—')}%`)}</Text>
        {lines.map((raw, i) => {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
          const line = raw as Record<string, unknown>;
          return <Text key={i}>{String(line.name ?? line.item_code ?? '')} — {String(line.percent ?? '—')}%</Text>;
        })}</VStack>;
    })}
  </VStack>;
}

// @v2 RpsQrReprintSheet
function RollSheet({ roll }: { roll: Roll }) {
  const t = usePreparationText();
  const image = useMemo(() => {
    try { const qr = qrFactory(0, 'M'); qr.addData(roll.epc); qr.make(); return qr.createDataURL(5, 20); }
    catch { return ''; }
  }, [roll.epc]);
  return <Host style={{ minHeight: 450 }}><VStack spacing={12}><Text>{t('Chop etilgan QR')}</Text>
    <Text>{roll.item_name || roll.item_code}</Text>
    {!!image && <RNHostView matchContents><Image source={{ uri: image }} style={{ width: 200, height: 200, backgroundColor: 'white' }}
      contentFit="contain" accessibilityLabel={t('Chop etilgan QR')} /></RNHostView>}
    <Text>{roll.epc}</Text><List><Recipe recipe={roll.preparation_formula} /></List>
    <Button label={t('Qayta chop etish')} modifiers={[disabled(true)]} />
  </VStack></Host>;
}

// @v2 PreparationProductionScreen
export function PreparationProduction() {
  const { session } = usePreparationContext(), t = usePreparationText();
  const filters = useRef({ query: '', status: 'all' }), searchText = useRef(''), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState('all');
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
    setStatus(value); filters.current.status = value; filters.current.query = searchText.current.trim(); void current.current?.load();
  };
  const labels: Record<string, string> = { all: 'Barchasi', active: 'Davom etmoqda', completed: 'Yakunlangan' };
  return <><Stack.Screen options={{ title: t('Ishlab chiqarish') }} /><PreparationList refresh={async () => { await current.current?.load(); }}>
    <Section><TextField placeholder={t('Buyurtma, homashyo yoki formula')} onTextChange={search} />
      <Menu label={`${t('Holat')}: ${t(labels[status])}`}>{Object.entries(labels).map(([key, label]) =>
        <Button key={key} label={t(label)} onPress={() => changeStatus(key)} />)}</Menu></Section>
    <JournalFooter state={state} empty="Hali ishlab chiqarish yozuvlari yo‘q." more={() => { void current.current?.load({ append: true }); }} reload={() => { void current.current?.load(); }} />
    <Section>{state.items.map(order => <Button key={order.order_id} onPress={() => openPreparationRoute('production-order', { id: order.order_id })}>
      <VStack alignment="leading"><Text>{order.order_code || order.order_id} · {order.order_title}</Text>
        <Text>{order.customer_name} · {order.batch_count} ta ishlab chiqarish{order.active_batch_count > 0 ? ` · ${order.active_batch_count} ta davom etmoqda` : ''} · {preparationJournalDate(order.last_activity_at)}</Text>
        <Text>{order.roll_count} ta rulon · {preparationDisplay(order.total_net_kg)} kg · {preparationDisplay(order.total_length_m)} m</Text></VStack>
    </Button>)}</Section>
  </PreparationList></>;
}

// @v2 PreparationProductionOrderScreen
export function PreparationProductionOrder() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext(), t = usePreparationText();
  const make = useCallback((changed: (state: JournalState<Batch, Order>) => void) => createPreparationProductionOrderJournal(session, id, changed), [session, id]);
  const { state, current } = useJournal(make);
  return <><Stack.Screen options={{ title: state.summary ? `${t('Buyurtma')}: ${state.summary.order_code || state.summary.order_id}` : t('Buyurtma ishlab chiqarishi') }} />
    <PreparationList refresh={async () => { await current.current?.load(); }}>
      {state.summary && <Section><Text>{state.summary.order_title}</Text><Text>{state.summary.customer_name}</Text>
        <Text>{state.summary.roll_count} ta rulon · {preparationDisplay(state.summary.total_net_kg)} kg · {preparationDisplay(state.summary.total_length_m)} m</Text></Section>}
      <JournalFooter state={state} empty="Bu buyurtma bo‘yicha ishlab chiqarish yozuvi yo‘q." more={() => { void current.current?.load({ append: true }); }} reload={() => { void current.current?.load(); }} />
      <Section>{state.items.map(batch => <Button key={batch.batch_id} onPress={() => openPreparationRoute('production-batch', { id: batch.batch_id })}>
        <VStack alignment="leading"><Text>{batch.item_name || batch.item_code}</Text><Text>{String(batch.preparation_formula?.variant_name ?? '')} · {t(batch.active ? 'Davom etmoqda' : 'Yakunlangan')} · {batch.warehouse} · {preparationJournalDate(batch.last_activity_at)}</Text>
          <Text>{batch.roll_count} ta rulon · {preparationDisplay(batch.total_net_kg)} kg · {preparationDisplay(batch.total_length_m)} m</Text></VStack>
      </Button>)}</Section>
    </PreparationList></>;
}

// @v2 PreparationProductionBatchScreen
export function PreparationProductionBatch() {
  const { id = '' } = useLocalSearchParams<{ id: string }>(), { session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const make = useCallback((changed: (state: JournalState<Roll, Batch>) => void) => createPreparationProductionBatchJournal(session, id, changed), [session, id]);
  const { state, current } = useJournal(make);
  return <><Stack.Screen options={{ title: state.summary?.item_name || t('Ishlab chiqarish') }} />
    <PreparationList refresh={async () => { await current.current?.load(); }}>
      {state.summary && <Section><Text>{t(state.summary.active ? 'Davom etmoqda' : 'Yakunlangan')}</Text>
        <Text>{state.summary.warehouse} · {t('Boshlangan')}: {preparationJournalDate(state.summary.started_at)}</Text>
        {!!state.summary.ended_at && <Text>{t('Tugagan')}: {preparationJournalDate(state.summary.ended_at)}</Text>}
        <Text>{state.summary.roll_count} ta rulon · {preparationDisplay(state.summary.total_net_kg)} kg · {preparationDisplay(state.summary.total_length_m)} m</Text>
        <Recipe recipe={state.summary.preparation_formula} /></Section>}
      <JournalFooter state={state} empty="Hali rulon kirim qilinmagan." more={() => { void current.current?.load({ append: true }); }} reload={() => { void current.current?.load(); }} />
      <Section>{state.items.map(roll => <Button key={roll.epc} onPress={() => sheet.open(<RollSheet roll={roll} />, { compact: true, dismissible: true })}>
        <VStack alignment="leading"><Text>{roll.epc}</Text><Text>{preparationJournalDate(roll.printed_at)} · {roll.warehouse}</Text>
          <Text>{preparationDisplay(roll.net_kg)} kg{roll.length_m ? ` · ${preparationDisplay(roll.length_m)} m` : ''}{roll.width_mm ? ` · ${preparationDisplay(roll.width_mm)} mm` : ''}{roll.micron ? ` · ${preparationDisplay(roll.micron)} mkm` : ''}</Text></VStack>
      </Button>)}</Section>
    </PreparationList></>;
}
