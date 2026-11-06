import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { WorkerOrderHeader, WorkerOrderImage } from '../components/WorkerOrderHeader';
import { WorkerOrderOverview } from '../components/WorkerOrderOverview';
import { WorkerOrderSheet } from '../components/WorkerOrderSheet';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { preparationOrderMaterials } from '../preparationReadApi';
import { sessionReadScope } from '../sessionReadScope';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { workerOrderDetailFromSnapshot } from '../workerApi';
import { usePreparationContext } from './PreparationContext.android';
import { preparationOrderDetail, type PreparationOrderListRow } from './preparationOrdersApi';
import { subscribePreparationOrdersLive } from './preparationOrdersLive';
import { PreparationOrdersState } from './preparationOrdersState';
import { preparationOrdersWarmStore } from './preparationRuntime';
import { PreparationButton, PreparationDialogs, PreparationField, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

type Props = { session: Session; controller: PreparationOrdersState;
  selectApparatus: (id: string) => Promise<void>; openOrder: (row: PreparationOrderListRow) => void };
const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
function sequenceLifecycle(controller: PreparationOrdersState) {
  let mounts = 0, started = false;
  return { mount() {
    mounts++;
    if (!started) { started = true; void controller.start(); }
    return () => { mounts--; queueMicrotask(() => { if (!mounts) controller.dispose(); }); };
  } };
}

// @v2 _PreparationOrdersListState
export function PreparationSequenceList({ session, controller, selectApparatus, openOrder }: Props) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [query, setQuery] = useState(''), dialogs = usePreparationDialogs(), t = usePreparationText();
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), visible = useRef(false), focusedOnce = useRef(false);
  const lifecycle = useMemo(() => sequenceLifecycle(controller), [controller]);
  useEffect(() => lifecycle.mount(), [lifecycle]);
  useEffect(() => { const frame = requestAnimationFrame(() => setImagesEnabled(true)); return () => cancelAnimationFrame(frame); }, []);
  useFocusEffect(useCallback(() => {
    visible.current = true;
    if (focusedOnce.current || AppState.currentState !== 'active') controller.setForeground(AppState.currentState === 'active');
    focusedOnce.current = true;
    return () => { visible.current = false; controller.setForeground(false); };
  }, [controller]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', value => controller.setForeground(visible.current && value === 'active'));
    return () => sub.remove();
  }, [controller]);
  const choose = async () => {
    const selection = await dialogs.choose('Apparat', (state.window?.apparatus ?? []).map(item => ({ label: item.name, value: item.id })));
    if (selection === null || selection === state.apparatus) return;
    try { await selectApparatus(selection); await controller.changeQuery({ apparatus: selection }); }
    catch (error) { dialogs.message('Xatolik yuz berdi', String(error)); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <View style={{ padding: 16 }}><PreparationText title>{t('Ketma-ketlik')}</PreparationText>
      <PreparationButton label="Orqaga" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }} /></View>
    <FlatList data={state.rows} keyExtractor={item => item.id} contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 8, paddingBottom: insets.bottom + 20 }}
      refreshControl={<RefreshControl refreshing={state.loading && !!state.rows.length} onRefresh={() => void controller.reload(true)} />}
      onEndReached={() => void controller.loadMore()} onEndReachedThreshold={0.5}
      ListHeaderComponent={<View style={{ gap: 8, marginBottom: 8 }}>
        <PreparationField label={productionText('worker.queue.search.sequence', locale)} initial={query} onChange={value => { setQuery(value); controller.searchChanged(value); }} />
        <PreparationRow title={t('Apparat')} subtitle={state.window?.apparatus.find(item => item.id === state.apparatus)?.name ?? ''} onPress={() => void choose()} />
        {state.error ? <><PreparationText>{state.error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => void controller.reload(true)} /></> : null}
        {state.loading && !state.rows.length ? <ActivityIndicator /> : null}
        {!state.loading && !state.error && !state.rows.length ? <PreparationText>{t('Mos buyurtma topilmadi.')}</PreparationText> : null}
      </View>}
      renderItem={({ item }) => <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <WorkerOrderThumbnail session={session} orderId={item.id} imageId={item.image_id} active={imagesEnabled} backgroundColor={colors.surface} iconColor={colors.onSurfaceVariant} />
        <View style={{ flex: 1 }}><PreparationRow title={`${item.position}. ${item.code || item.order_number || item.id} · ${item.title}`}
          subtitle={item.customer_name} onPress={() => openOrder(item)} /></View>
      </View>}
      ListFooterComponent={state.window?.next_cursor ? <PreparationButton label="Yana yuklash" disabled={state.loading} onPress={() => void controller.loadMore()} /> : undefined} />
  </View>;
}

function createSequenceBinding(session: Session) {
  let valid = true;
  const scope = sessionReadScope(session);
  const current = () => valid && !!activeSessionToken(session) && scope === sessionReadScope(session);
  const controller = new PreparationOrdersState(preparationOrdersWarmStore, current,
    (window, search, length, message, error, done) => subscribePreparationOrdersLive(session, window, { search, length }, message, error, done),
    () => adminSequenceApparatusStore.loadSavedApparatusId());
  return { controller, current, invalidate() { valid = false; controller.sessionChanged(); } };
}

export function PreparationSequenceScreen() {
  const { session } = usePreparationContext();
  const [selected, setSelected] = useState<{ row: PreparationOrderListRow; scope: string } | null>(null);
  const binding = useMemo(() => createSequenceBinding(session), [session]);
  useEffect(() => registerSessionResetHook(async () => { binding.invalidate(); setSelected(null); }), [binding]);
  const selectApparatus = async (id: string) => {
    const item = binding.controller.getSnapshot().window?.apparatus.find(value => value.id === id);
    if (item && binding.current()) await adminSequenceApparatusStore.saveApparatus(item);
  };
  return <View style={{ flex: 1 }}>
    <PreparationSequenceList session={session} controller={binding.controller} selectApparatus={selectApparatus}
      openOrder={row => { const scope = binding.controller.getSnapshot().window?.scope; if (scope) setSelected({ row, scope }); }} />
    {selected ? <WorkerOrderSheet onClose={() => setSelected(null)} dismissible={false}>
      <PreparationDialogs><PreparationSequenceDetail session={session} controller={binding.controller} selected={selected}
        isCurrent={binding.current} close={() => setSelected(null)} /></PreparationDialogs>
    </WorkerOrderSheet> : null}
  </View>;
}

function PreparationSequenceDetail({ session, controller, selected, isCurrent, close }: {
  session: Session; controller: PreparationOrdersState; selected: { row: PreparationOrderListRow; scope: string };
  isCurrent: () => boolean; close: () => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [result, setResult] = useState<{ retry: number; value: Awaited<ReturnType<typeof preparationOrderDetail>> | null; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0), [loadingMaterials, setLoadingMaterials] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const dialogs = usePreparationDialogs(), t = usePreparationText();
  const current = () => isCurrent() && controller.getSnapshot().window?.scope === selected.scope &&
    controller.getSnapshot().rows.some(row => row.id === selected.row.id);
  const valid = isCurrent() && state.window?.scope === selected.scope && state.rows.some(row => row.id === selected.row.id);
  useEffect(() => {
    let mounted = true;
    void preparationOrderDetail(session, selected.row.id).then(value => {
      if (mounted && current()) setResult({ retry, value, error: null });
    }, failure => { if (mounted && current()) setResult({ retry, value: null, error: failure instanceof Error ? failure.message : String(failure) }); });
    return () => { mounted = false; };
    // The selected row and controller identify the detail request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, controller, selected, retry]);
  const latest = result?.retry === retry ? result : null;
  const detail = latest?.value ? workerOrderDetailFromSnapshot(latest.value, selected.row.id) : null;
  const error = latest?.error ?? null;
  const openFormulas = async () => {
    if (!detail || !current() || loadingMaterials) return;
    setLoadingMaterials(true);
    try {
      const materials = await preparationOrderMaterials(session, selected.row.id);
      if (!current()) return;
      if (!materials.length) { dialogs.message('Xatolik yuz berdi', 'Bu orderda sizga biriktirilgan homashyo topilmadi.'); return; }
      const id = await dialogs.choose('Homashyo tanlang', materials.map(item => ({ label: item.material_name || item.material_id, value: item.material_id })), undefined, true);
      const material = materials.find(item => item.material_id === id);
      if (!material || !current()) return;
      const options = { orderId: selected.row.id, orderCode: String(detail.map.order_number || detail.map.code || selected.row.code),
        productCode: String(detail.map.product_code ?? ''), productTitle: String(detail.map.title || selected.row.title),
        materialId: material.material_id, materialName: material.material_name || material.material_id };
      close();
      requestAnimationFrame(() => router.push({ pathname: '/android-preparation/variants', params: { data: JSON.stringify(options) } } as unknown as Href));
    } catch (failure) { if (current()) dialogs.message('Xatolik yuz berdi', failure instanceof Error ? failure.message : String(failure)); }
    finally { setLoadingMaterials(false); }
  };
  if (imageOpen && valid) return <WorkerOrderImage session={session} orderId={selected.row.id} imageId={selected.row.image_id} onClose={() => setImageOpen(false)} />;
  return <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 10 }}>
    <WorkerOrderHeader session={session} orderId={selected.row.id} imageId={selected.row.image_id}
      code={selected.row.order_number || selected.row.code || selected.row.id} onOpenImage={() => setImageOpen(true)} onClose={close} />
    {!valid ? <PreparationText>{t('Buyurtma o‘zgargan. Qayta oching.')}</PreparationText> : null}
    {valid && !detail && !error ? <ActivityIndicator /> : null}
    {valid && error ? <><PreparationText>{error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => setRetry(value => value + 1)} /></> : null}
    <WorkerOrderOverview session={session} orderId={selected.row.id} code={selected.row.code} title={selected.row.title}
      imageId={selected.row.image_id} detail={valid ? detail : null} />
    {valid && detail ? <PreparationButton label="Formulalar" disabled={loadingMaterials} onPress={() => void openFormulas()} /> : null}
  </ScrollView>;
}
