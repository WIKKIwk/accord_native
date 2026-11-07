import { Host, ModalBottomSheet, RNHostView, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, AppState, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { WorkerOrderHeader, WorkerOrderImage } from '../components/WorkerOrderHeader';
import { ListItem } from '@expo/ui';
import { useSharedValue } from 'react-native-reanimated';
import { OrdersWorkspace } from '../shared/orders/OrdersWorkspace';
import { OrdersList } from '../shared/orders/OrdersList';
import { OrderListItem } from '../shared/orders/OrderListItem';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { preparationOrderMaterials } from '../preparationReadApi';
import { sessionReadScope } from '../sessionReadScope';
import { productionText } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { workerOrderDetailFromSnapshot } from '../workerApi';
import type { calculateOrderTemplateFromJson } from '../workerOpenedOrderEditApi';
import type { productionMapDefinitionFromJson } from '../workerProductionMapSaved';
import { usePreparationContext } from './PreparationContext.android';
import { InventoryDetailRow, InventorySheetButton } from './PreparationInventoryDetails.android';
import { preparationOrderDetail, type PreparationOrderListRow } from './preparationOrdersApi';
import { preparationOrderDisplayCode, preparationOrderMetrics, preparationOrderProductTitle } from './preparationOrderMetrics';
import { subscribePreparationOrdersLive } from './preparationOrdersLive';
import { PreparationOrdersState } from './preparationOrdersState';
import { preparationAllOrdersWarmStore } from './preparationRuntime';
import { PreparationButton, PreparationDialogs, PreparationDock, PreparationText, usePreparationDialogs, usePreparationText } from './PreparationUI.android';

type Props = { session: Session; controller: PreparationOrdersState; openOrder: (row: PreparationOrderListRow) => void };
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
export function PreparationSequenceList({ session, controller, openOrder }: Props) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [query, setQuery] = useState(''), t = usePreparationText();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(70);
  const [headerSize, setHeaderSize] = useState(70);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), visible = useRef(false), focusedOnce = useRef(false);
  const lifecycle = useMemo(() => sequenceLifecycle(controller), [controller]);
  useEffect(() => lifecycle.mount(), [lifecycle]);
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
  const header = <View onLayout={event => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) { headerHeight.set(height); setHeaderSize(height); }
  }}><OrdersHeader search={query} onSearchChange={value => { setQuery(value); controller.searchChanged(value); }}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/android-preparation' as Href); }}
    onProfile={() => router.navigate('/android-preparation/profile' as Href)} /></View>;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersWorkspace session={session} tabs={[{ id: '', name: t('Buyurtmalar') }]} selected=""
      onSelect={() => {}} loading={state.loading && !state.window} header={header} headerOffset={headerOffset}>
      {(tabId, pagerGesture) => <OrdersList active={tabId === state.apparatus} pagerGesture={pagerGesture}
        headerOffset={headerOffset} headerHeight={headerHeight} topInset={headerSize + 48}
        onRefresh={() => controller.reload(true)} onEndReached={() => { if (tabId === state.apparatus && !state.error) void controller.loadMore(); }}>
        {!!state.error && <ListItem supportingText={state.error} onPress={() => void controller.reload(true)}>{t('Qayta urinish')}</ListItem>}
        {!state.loading && !state.error && !state.rows.length && <ListItem>{t('Mos buyurtma topilmadi.')}</ListItem>}
        {tabId === state.apparatus && state.rows.map((row, index) => <OrderListItem key={row.id}
          session={session} orderId={row.id} imageId={row.image_id} imageActive last={index === state.rows.length - 1}
          headline={`${row.position}. ${row.code || row.order_number || row.id} · ${row.title}`} supportingText={row.customer_name}
          onPress={() => openOrder(row)} />)}
        {state.loading && state.rows.length > 0 && state.window?.next_cursor ? <ActivityIndicator /> : null}
      </OrdersList>}
    </OrdersWorkspace>
  </View>;
}

function createSequenceBinding(session: Session) {
  let valid = true;
  const scope = sessionReadScope(session);
  const current = () => valid && !!activeSessionToken(session) && scope === sessionReadScope(session);
  const controller = new PreparationOrdersState(preparationAllOrdersWarmStore, current,
    (window, search, length, message, error, done) => subscribePreparationOrdersLive(session, window, { search, length, allApparatus: true }, message, error, done),
    async () => null);
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
    return () => setSelected(null);
  }, [binding]));
  const openVariants = (options: VariantOptions) => {
    returnDetail.current = selected;
    setSelected(null);
    requestAnimationFrame(() => router.push({ pathname: '/android-preparation/variants', params: { data: JSON.stringify(options) } } as unknown as Href));
  };
  return <View style={{ flex: 1 }}>
    <View style={{ flex: 1, minHeight: 0 }}>
      <PreparationSequenceList session={session} controller={binding.controller}
        openOrder={row => { const scope = binding.controller.getSnapshot().window?.scope; if (scope) setSelected({ row, scope }); }} />
    </View>
    <View style={{ flexShrink: 0 }}><PreparationDock /></View>
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
      <RNHostView matchContents><View style={{ width, maxHeight: Math.round((height - insets.top) * 0.86) }}>
        <View style={{ flexShrink: 1, minHeight: 0 }}>{children}</View>
        <View style={{ flexShrink: 0 }}><PreparationDock /></View>
      </View></RNHostView>
    </ModalBottomSheet>
  </Host>;
}

function PreparationSequenceDetail({ session, controller, selected, isCurrent, close, openVariants }: {
  session: Session; controller: PreparationOrdersState; selected: { row: PreparationOrderListRow; scope: string };
  isCurrent: () => boolean; close: () => void; openVariants: (options: VariantOptions) => void;
}) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [result, setResult] = useState<{ retry: number; value: Awaited<ReturnType<typeof preparationOrderDetail>> | null;
    metrics: { kg: number | null; length: number | null } | null; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0), [loadingMaterials, setLoadingMaterials] = useState(false);
  const [imageOpen, setImageOpen] = useState(false), [expanded, setExpanded] = useState(true);
  const dialogs = usePreparationDialogs(), t = usePreparationText();
  const colors = useMaterialColors(), { height } = useWindowDimensions(), insets = useSafeAreaInsets();
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
  const customer = detail?.customer || selected.row.customer_name;
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
  if (imageOpen && valid) return <View style={{ height: Math.round((height - insets.top - insets.bottom) * 0.65) }}>
    <WorkerOrderImage session={session} orderId={selected.row.id} imageId={selected.row.image_id} onClose={() => setImageOpen(false)} />
  </View>;
  return <View style={{ flexShrink: 1, minHeight: 0 }}>
    <ScrollView nestedScrollEnabled style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: 16, gap: 12 }}>
    <WorkerOrderHeader session={session} orderId={selected.row.id} imageId={selected.row.image_id}
      code={code || '-'} onOpenImage={() => setImageOpen(true)} onClose={close} />
    <View style={{ paddingHorizontal: 16, gap: 4 }}>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <ComposeText color={colors.onSurface} style={{ typography: 'titleLarge', fontSize: 20 }}>{title}</ComposeText>
      </Host>
      {customer ? <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <ComposeText color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>{customer}</ComposeText>
      </Host> : null}
    </View>
    {!valid ? <View style={{ paddingHorizontal: 16 }}><PreparationText>{t('Buyurtma o‘zgargan. Qayta oching.')}</PreparationText></View> : null}
    {valid && !detail && !error ? <ActivityIndicator /> : null}
    {valid && error ? <View style={{ paddingHorizontal: 16, gap: 8 }}>
      <PreparationText>{error}</PreparationText><PreparationButton label="Qayta urinish" onPress={() => setRetry(value => value + 1)} />
    </View> : null}
    <View style={{ marginHorizontal: 16, paddingBottom: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceContainerLow }}>
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <ListItem colors={{ containerColor: colors.surfaceContainerLow }}
        onPress={valid && detail ? () => setExpanded(value => !value) : undefined}
        trailing={<RNHostView matchContents><SymbolView name={{ android: expanded ? 'expand_less' : 'expand_more' }}
          size={24} tintColor={colors.onSurfaceVariant} /></RNHostView>}>
        {productionText('worker.summary.expected.result_title', locale)}
      </ListItem>
    </Host>
    {valid && detail && map && expanded ? <View style={{ paddingHorizontal: 16, gap: 4 }}>
      {latest?.metrics?.length ? <InventoryDetailRow label={productionText('worker.summary.length', locale)}
        value={productionText('worker.summary.length_value', locale, { value: Math.ceil(latest.metrics.length / 500) * 500 })} /> : null}
      {latest?.metrics?.kg ? <InventoryDetailRow label={productionText('worker.summary.weight', locale)}
        value={productionText('worker.summary.weight_value', locale, { value: latest.metrics.kg })} /> : null}
      {map.roll_count && map.roll_count > 0 ? <>
        <InventoryDetailRow label={productionText('worker.summary.shafts', locale)}
          value={productionText('worker.summary.frame_count_value', locale, { count: map.roll_count })} />
        <InventoryDetailRow label="Eni" value={map.width_mm && map.width_mm > 0 ? `${map.width_mm} mm` : '—'} />
      </> : null}
      <InventoryDetailRow label={productionText('order.print_side', locale)} value={productionText(map.standard_print_side === false ? 'order.print_side.nonstandard' : 'order.print_side.standard', locale)} />
    </View> : null}
    </View>
    </ScrollView>
    {valid && detail ? <View style={{ flexShrink: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
      <InventorySheetButton label="Formulalar" large disabled={loadingMaterials} onPress={() => void openFormulas()} />
    </View> : null}
  </View>;
}
