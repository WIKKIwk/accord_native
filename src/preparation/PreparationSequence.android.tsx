import { Host, ModalBottomSheet, RNHostView, useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { WorkerOrderHeader, WorkerOrderImage } from '../components/WorkerOrderHeader';
import { WorkerOrderThumbnail } from '../components/WorkerOrderThumbnail';
import { preparationOrderMaterials } from '../preparationReadApi';
import { sessionReadScope } from '../sessionReadScope';
import { adminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { workerOrderDetailFromSnapshot } from '../workerApi';
import type { calculateOrderTemplateFromJson } from '../workerOpenedOrderEditApi';
import type { productionMapDefinitionFromJson } from '../workerProductionMapSaved';
import { usePreparationContext } from './PreparationContext.android';
import { preparationOrderDetail, type PreparationOrderListRow } from './preparationOrdersApi';
import { preparationOrderDisplayCode, preparationOrderMetrics, preparationOrderProductTitle } from './preparationOrderMetrics';
import { subscribePreparationOrdersLive } from './preparationOrdersLive';
import { PreparationOrdersState } from './preparationOrdersState';
import { preparationOrdersWarmStore } from './preparationRuntime';
import { PreparationButton, PreparationDialogs, PreparationField, PreparationRow, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

type Props = { session: Session; controller: PreparationOrdersState;
  selectApparatus: (id: string) => Promise<void>; openOrder: (row: PreparationOrderListRow) => void };
type VariantOptions = { orderId: string; orderCode: string; productCode: string; productTitle: string; materialId: string; materialName: string };
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

// @v2 AdminProductionMapOrdersScreen
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
  const returnDetail = useRef<typeof selected>(null);
  const binding = useMemo(() => createSequenceBinding(session), [session]);
  useEffect(() => registerSessionResetHook(async () => { binding.invalidate(); returnDetail.current = null; setSelected(null); }), [binding]);
  useFocusEffect(useCallback(() => {
    const previous = returnDetail.current;
    if (previous && binding.current()) { returnDetail.current = null; setSelected(previous); }
  }, [binding]));
  const selectApparatus = async (id: string) => {
    const item = binding.controller.getSnapshot().window?.apparatus.find(value => value.id === id);
    if (item && binding.current()) await adminSequenceApparatusStore.saveApparatus(item);
  };
  const openVariants = (options: VariantOptions) => {
    returnDetail.current = selected;
    setSelected(null);
    requestAnimationFrame(() => router.push({ pathname: '/android-preparation/variants', params: { data: JSON.stringify(options) } } as unknown as Href));
  };
  return <View style={{ flex: 1 }}>
    <PreparationSequenceList session={session} controller={binding.controller} selectApparatus={selectApparatus}
      openOrder={row => { const scope = binding.controller.getSnapshot().window?.scope; if (scope) setSelected({ row, scope }); }} />
    {selected ? <PreparationDetailSheet>
      <PreparationDialogs><PreparationSequenceDetail session={session} controller={binding.controller} selected={selected}
        isCurrent={binding.current} close={() => setSelected(null)} openVariants={openVariants} /></PreparationDialogs>
    </PreparationDetailSheet> : null}
  </View>;
}

function PreparationDetailSheet({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), colors = useMaterialColors();
  return <Host style={{ position: 'absolute', top: 0, bottom: 0, width }} pointerEvents="none">
    <ModalBottomSheet onDismissRequest={() => {}} skipPartiallyExpanded sheetGesturesEnabled={false} showDragHandle={false}
      containerColor={colors.surface} properties={{ shouldDismissOnBackPress: false, shouldDismissOnClickOutside: false }}>
      <RNHostView matchContents><View style={{ width, height: Math.round((height - insets.top) * 0.86), paddingBottom: insets.bottom }}>{children}</View></RNHostView>
    </ModalBottomSheet>
  </Host>;
}

function PreparationSequenceDetail({ session, controller, selected, isCurrent, close, openVariants }: {
  session: Session; controller: PreparationOrdersState; selected: { row: PreparationOrderListRow; scope: string };
  isCurrent: () => boolean; close: () => void; openVariants: (options: VariantOptions) => void;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [result, setResult] = useState<{ retry: number; value: Awaited<ReturnType<typeof preparationOrderDetail>> | null;
    metrics: { kg: number | null; length: number | null } | null; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0), [loadingMaterials, setLoadingMaterials] = useState(false);
  const [imageOpen, setImageOpen] = useState(false), [expanded, setExpanded] = useState(true);
  const dialogs = usePreparationDialogs(), t = usePreparationText();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const current = () => isCurrent() && controller.getSnapshot().window?.scope === selected.scope &&
    controller.getSnapshot().rows.some(row => row.id === selected.row.id);
  const valid = isCurrent() && state.window?.scope === selected.scope && state.rows.some(row => row.id === selected.row.id);
  useEffect(() => {
    let mounted = true;
    void preparationOrderDetail(session, selected.row.id).then(async value => {
      if (!mounted || !current()) return;
      const map = value.maps[0].map as ReturnType<typeof productionMapDefinitionFromJson>;
      const templates = Object.values(value.calculation_templates ?? {}) as ReturnType<typeof calculateOrderTemplateFromJson>[];
      const metrics = await preparationOrderMetrics(session, map, templates);
      if (mounted && current()) setResult({ retry, value, metrics, error: null });
    }, failure => { if (mounted && current()) setResult({ retry, value: null, metrics: null, error: failure instanceof Error ? failure.message : String(failure) }); });
    return () => { mounted = false; };
    // The selected row and controller identify the detail request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, controller, selected, retry]);
  const latest = result?.retry === retry ? result : null;
  const detail = latest?.value ? workerOrderDetailFromSnapshot(latest.value, selected.row.id) : null;
  const map = latest?.value?.maps[0].map as ReturnType<typeof productionMapDefinitionFromJson> | undefined;
  const code = map ? preparationOrderDisplayCode(map) : selected.row.code || selected.row.order_number;
  const title = map ? map.title.trim() || preparationOrderProductTitle(map) || productionText('worker.order.fallback', locale) : selected.row.title;
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
      const options = { orderId: selected.row.id, orderCode: code,
        productCode: String(detail.map.product_code ?? ''), productTitle: title,
        materialId: material.material_id, materialName: material.material_name || material.material_id };
      openVariants(options);
    } catch (failure) { if (current()) dialogs.message('Xatolik yuz berdi', failure instanceof Error ? failure.message : String(failure)); }
    finally { setLoadingMaterials(false); }
  };
  if (imageOpen && valid) return <WorkerOrderImage session={session} orderId={selected.row.id} imageId={selected.row.image_id} onClose={() => setImageOpen(false)} />;
  return <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 16, gap: 10 }}>
    <WorkerOrderHeader session={session} orderId={selected.row.id} imageId={selected.row.image_id}
      code={code || '-'} onOpenImage={() => setImageOpen(true)} onClose={close} />
    <PreparationText>{[detail?.customer || selected.row.customer_name, title].filter(Boolean).join(' • ')}</PreparationText>
    {!valid ? <PreparationText>{t('Buyurtma o‘zgargan. Qayta oching.')}</PreparationText> : null}
    {valid && !detail && !error ? <ActivityIndicator /> : null}
    {valid && error ? <><PreparationText>{error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => setRetry(value => value + 1)} /></> : null}
    <PreparationRow title={productionText('worker.summary.expected.title', locale)} subtitle={productionText('worker.summary.expected.subtitle', locale)}
      disabled={!detail} onPress={() => setExpanded(value => !value)} />
    {valid && detail && map && expanded ? <>
      {latest?.metrics?.length ? <PreparationRow title={productionText('worker.summary.length', locale)}
        subtitle={productionText('worker.summary.length_value', locale, { value: Math.ceil(latest.metrics.length / 500) * 500 })} /> : null}
      {latest?.metrics?.kg ? <PreparationRow title={productionText('worker.summary.weight', locale)}
        subtitle={productionText('worker.summary.weight_value', locale, { value: latest.metrics.kg })} /> : null}
      {map.roll_count && map.roll_count > 0 ? <PreparationRow title={productionText('worker.summary.shafts', locale)}
        subtitle={productionText('worker.summary.shaft_value', locale, { count: map.roll_count, width: map.width_mm && map.width_mm > 0 ? map.width_mm : '—' })} /> : null}
      <PreparationRow title={productionText('order.print_side', locale)} subtitle={productionText(map.standard_print_side === false ? 'order.print_side.nonstandard' : 'order.print_side.standard', locale)} />
    </> : null}
    {valid && detail ? <PreparationButton label="Formulalar" disabled={loadingMaterials} onPress={() => void openFormulas()} /> : null}
  </ScrollView>;
}
